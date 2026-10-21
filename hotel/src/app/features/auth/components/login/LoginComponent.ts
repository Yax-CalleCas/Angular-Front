import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // <-- Necesario para *ngIf
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginRequest } from '../../../../core/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // <-- Añadido CommonModule
  templateUrl: './LoginComponent.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage: string | null = null;
  isLoading: boolean = false; // Para deshabilitar el botón mientras carga

  loginForm: FormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    clave: ['', [Validators.required, Validators.minLength(4)]]
  });

  // Getter para acceder fácil a los controles desde el HTML
  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched(); // Marca los campos para que salgan las alertas visuales
      return;
    }

    this.errorMessage = null;
    this.isLoading = true;

    const credentials: LoginRequest = {
      correo: this.loginForm.value.correo,
      clave: this.loginForm.value.clave
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.isLoading = false;
        const role = response.tipoPersona;
        const sedes = response.sedes || [];

        if (sedes.length > 0) {
          localStorage.setItem('sede_activa', JSON.stringify(sedes[0]));
        }

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
        this.isLoading = false;
        console.error('Error en el login:', err);

        // Captura inteligente incluyendo el código 423 (Locked / Cuenta Bloqueada)
        if (err.status === 423) {
          this.errorMessage = err.error || 'Cuenta bloqueada temporalmente por intentos fallidos.';
        } else if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (err.error && err.error.message) {
          this.errorMessage = err.error.message;
        } else if (err.status === 401 || err.status === 403) {
          this.errorMessage = 'Correo o contraseña incorrectos. Verifique sus datos.';
        } else {
          this.errorMessage = 'Ocurrió un problema de conexión con el servidor. Inténtalo más tarde.';
        }
      }
    });
  }
}
