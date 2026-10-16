import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; // Asegúrate de ajustar esta ruta a tu proyecto

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.html',
  styleUrls: ['./layout.scss']
})
export class Layout {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService); // Inyectamos el servicio

  // Obtenemos el nombre del usuario para el header
  get usuarioNombre(): string {
    return localStorage.getItem('usuario') || 'Usuario';
  }

  // Lógica centralizada para verificar roles
  hasRole(role: string): boolean {
    // Ajusta 'getUserRole()' al método que tengas en tu AuthService
    return this.authService.getUserRole() === role;
  }

  cerrarSesion(): void {
    localStorage.clear(); // Limpieza total
    this.router.navigate(['/login']);
  }
}
