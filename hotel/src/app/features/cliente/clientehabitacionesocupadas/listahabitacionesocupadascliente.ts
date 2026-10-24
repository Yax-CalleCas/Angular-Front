import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import Swal from 'sweetalert2';
import { RecepcionService } from '../../../core/services/recepcion.service';
import { RecepcionResponseDTO } from '../../../core/models/recepcion.model';
import { AuthService } from '../../../core/services/auth.service';
import { ApiResponse } from '../../../core/models/ApiResponse';

const TIMEOUT_CARGA_MS = 30000;

@Component({
  selector: 'app-cliente-habitaciones-ocupadas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './listahabitacionesocupadascliente.html',
})
export class ClienteHabitacionesDisponiblesComponent implements OnInit {
  private readonly recepcionService = inject(RecepcionService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals para el estado del componente
  readonly habitacionesActivas = signal<RecepcionResponseDTO[]>([]);
  readonly isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarHabitacionesDelCliente();
  }

  private cargarHabitacionesDelCliente(): void {
    const idPersonaString = this.authService.getUserId();
    const idPersona = idPersonaString ? Number(idPersonaString) : NaN;

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

    this.recepcionService.listarPorCliente(idPersona)
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res: ApiResponse<RecepcionResponseDTO[]>) => {
          const lista = res?.data ?? [];

          // Filtro corregido: Estancias activas (estado === true)
          // y que aún NO tengan fecha de salida confirmada (sin salida registrada)
          const activasParaCliente = lista.filter(item =>
            item.estado === true &&
            (!item.fechaSalidaConfirmacion || item.fechaSalidaConfirmacion.trim() === '')
          );

          this.habitacionesActivas.set(activasParaCliente);

          if (activasParaCliente.length === 0) {
            Swal.fire('Información', 'No tienes habitaciones ocupadas activas en este momento.', 'info');
          }
        },
        error: (err: unknown) => {
          console.error('Error al cargar habitaciones del cliente:', err);
          Swal.fire('Error', 'No se pudieron cargar tus reservas.', 'error');
        }
      });
  }

  irAlCarrito(habitacion: RecepcionResponseDTO): void {
    const idRecepcion = habitacion?.idRecepcion;

    if (!Number.isFinite(idRecepcion)) return;

    this.router.navigate(['/cliente/catalogo'], {
      state: { idRecepcion }
    });
  }

  trackById(index: number, item: RecepcionResponseDTO): number {
    return item.idRecepcion ?? index;
  }
}
