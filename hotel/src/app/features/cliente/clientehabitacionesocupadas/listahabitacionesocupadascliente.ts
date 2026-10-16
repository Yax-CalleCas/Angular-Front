import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RecepcionService } from '../../../core/services/recepcion.service';
import { Recepcion } from '../../../core/models/recepcion.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cliente-habitaciones-ocupadas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './listahabitacionesocupadascliente.html',
})
export class ClientehabitacionesdISPONIBLES implements OnInit {

  private readonly recepcionService = inject(RecepcionService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  habitacionesActivas = signal<Recepcion[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.cargarHabitacionesDelCliente();
  }

  private cargarHabitacionesDelCliente(): void {

    const idPersona = Number(this.authService.getUserId());

    if (!Number.isFinite(idPersona) || idPersona <= 0) {
      Swal.fire(
        'Error',
        'No se pudo identificar el usuario. Inicia sesión nuevamente.',
        'error'
      );
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.recepcionService.listarPorCliente(idPersona).subscribe({
      next: (res) => {
        this.habitacionesActivas.set(res.data ?? []);
        this.isLoading.set(false);

        if (!res.data || res.data.length === 0) {
          Swal.fire('Información', 'No tienes reservas activas.', 'info');
        }
      },
      error: () => {
        this.isLoading.set(false);
        Swal.fire('Error', 'No se pudieron cargar tus reservas.', 'error');
      }
    });
  }

  irAlCarrito(habitacion: Recepcion): void {

    const idRecepcion = habitacion?.idRecepcion;

    if (!Number.isFinite(idRecepcion)) return;

    this.router.navigate(['/cliente/catalogo'], {
      state: {
        idRecepcion
      }
    });
  }

  trackById(index: number, item: Recepcion): number {
    return item.idRecepcion ?? index;
  }
}
