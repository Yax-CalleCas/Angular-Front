// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  const platformId = inject(PLATFORM_ID);
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
      // Solo en el navegador: en SSR no hay localStorage ni sesión que cerrar.
      if (error.status === 401 && !esPublico && isPlatformBrowser(platformId)) {
        // Cerramos sesión únicamente si el token realmente venció o ya no existe.
        // Un 401 con token vigente suele ser un problema del microservicio
        // (secreto JWT distinto, ruta sin permiso): no debe tumbar la sesión.
        if (!authService.getToken() || authService.isTokenExpired()) {
          authService.logout();
          router.navigate(['/login']);
        } else {
          console.warn(`401 en ${req.url} con token vigente: revisar el secreto JWT o los permisos de ese microservicio.`);
        }
      }
      return throwError(() => error);
    })
  );
};
