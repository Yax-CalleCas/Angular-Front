import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { RegistroClienteDto } from '../../../core/models/auth.models';

@Component({
  selector: 'app-registro-cliente-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registroclientes.html',
  styleUrls: ['./registroclientes.scss']
})
export class RegistroClienteAdminComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading: boolean = false;

  registroForm: FormGroup = this.fb.group({
    tipoDocumento: ['DNI', Validators.required],
    documento: ['', [Validators.required, Validators.pattern(/^[0-9]{8,12}$/)]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    apellido: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    clave: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const dto: RegistroClienteDto = this.registroForm.value;

    this.authService.registrarCliente(dto).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire('¡Éxito!', 'Cliente registrado correctamente en el sistema.', 'success');
        this.registroForm.reset({ tipoDocumento: 'DNI' });
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error al registrar cliente:', err);
        const mensaje = err?.error?.message || err?.error || 'No se pudo completar el registro del cliente.';
        Swal.fire('Error', mensaje, 'error');
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/admin']);
  }
}
