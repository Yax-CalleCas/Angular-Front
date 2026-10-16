import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-empleado-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './empleado-dashboard.html'
})
export class EmpleadoDashboard {
  private readonly authService = inject(AuthService);

  cerrarSesion(): void {
    this.authService.logout();
  }
}
