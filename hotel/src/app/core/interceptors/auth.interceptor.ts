// src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // 🛡️ Excluimos todos los endpoints públicos de autenticación (login y registros)
  const isAuthEndpoint =
      req.url.includes('/api/auth/login') ||
      req.url.includes('/api/auth/register') ||
      req.url.includes('/api/auth/registro-cliente');

  let authReq = req;

  // Inyección del token Bearer omitiendo endpoints públicos de auth
  if (token && !isAuthEndpoint) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Omitimos también la idempotencia en las peticiones de login/registro
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !authReq.headers.has('Idempotency-Key') && !isAuthEndpoint) {
    authReq = authReq.clone({
      setHeaders: {
        'Idempotency-Key': crypto.randomUUID(),
        'Accept-Language': 'es-PE'
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
