// src/app/core/guards/auth.guard.ts
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // SSR: el servidor no tiene localStorage, se valida en el navegador
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Sin token o con token vencido: limpiar y mandar al login
  if (!authService.isLoggedIn()) {
    authService.logout();
    return router.createUrlTree(['/login']);
  }

  const rolesEsperados = route.data['roles'] as Array<string> | undefined;
  if (rolesEsperados && rolesEsperados.length > 0) {
    const userRole = authService.getUserRole();
    if (!rolesEsperados.includes(userRole ?? '')) {
      return router.createUrlTree(['/login']); // o '/acceso-denegado'
    }
  }

  return true;
};
