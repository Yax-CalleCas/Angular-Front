// src/app/core/guards/auth.guard.ts
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { isPlatformBrowser } from '@angular/common';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // 1. Control SSR: Si renderiza el servidor, permitimos la carga inicial
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // 2. Control de Autenticación estándar
  if (!authService.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  // 3. Control opcional de Roles (Data configurada en app.routes.ts)
  const rolesEsperados = route.data['roles'] as Array<string>;
  if (rolesEsperados && rolesEsperados.length > 0) {
    const userRole = authService.getUserRole();

    // Verificamos si el rol del LocalStorage coincide con los permitidos para esta vista
    const tienePermiso = rolesEsperados.includes(userRole || '');
    if (!tienePermiso) {
      // Si no tiene permisos (ej: Cliente intentando entrar a administración), redirigimos a una zona segura
      return router.createUrlTree(['/api/auth/login']);
    }
  }

  return true;
};
