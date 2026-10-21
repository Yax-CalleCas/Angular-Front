// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const RUTAS_PUBLICAS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/registro-cliente',
  '/api/persona/registro-publico'
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const esPublico = RUTAS_PUBLICAS.some(ruta => req.url.includes(ruta));

  let authReq = req;

  // Token Bearer solo en endpoints protegidos
  if (token && !esPublico) {
    authReq = authReq.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  // Idempotency-Key y Accept-Language en escrituras protegidas
  if (
    !esPublico &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    !authReq.headers.has('Idempotency-Key')
  ) {
    authReq = authReq.clone({
      setHeaders: {
        'Idempotency-Key': crypto.randomUUID(),
        'Accept-Language': 'es-PE'
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo cerramos sesión si el 401 viene de un endpoint protegido
      if (error.status === 401 && !esPublico) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
