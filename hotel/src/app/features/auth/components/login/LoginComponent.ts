// src/app/features/auth/components/login/login.component.ts
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginRequest } from '../../../../core/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './LoginComponent.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage: string | null = null;

  loginForm: FormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    clave: ['', [Validators.required]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.errorMessage = null;

    const credentials: LoginRequest = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        const role = response.tipoPersona;
        const sedes = response.sedes || [];

        console.log('Login exitoso. Rol:', role, '| Sedes autorizadas:', sedes.length);

        // Opcional: Si el usuario tiene sedes asignadas, podemos guardar la primera por defecto como sede activa de trabajo
        if (sedes.length > 0) {
          localStorage.setItem('sede_activa', JSON.stringify(sedes[0]));
        }

        // Redirección según rol del sistema
        switch (role) {
          case 'Administrador':
            this.router.navigate(['/admin']);
            break;
          case 'Empleado':
            this.router.navigate(['/empleado']);
            break;
          case 'Cliente':
            this.router.navigate(['/cliente']);
            break;
          default:
            this.router.navigate(['/dashboard']);
            break;
        }
      },
      error: (err) => {
        console.error('Error en el login:', err);

        // Captura inteligente de mensajes de BusinessException del backend (ej: "Usuario inactivo", "Contraseña incorrecta")
        if (err.error && typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else if (err.status === 401 || err.status === 403) {
          this.errorMessage = 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
        } else {
          this.errorMessage = 'Ocurrió un problema de conexión con el servidor. Inténtalo más tarde.';
        }
      }
    });
  }
}
