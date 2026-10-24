import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timeout } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { RecepcionService } from '../../../../core/services/recepcion.service';
import { HabitacionService } from '../../../../core/services/habitacion.service';
import { RecepcionResponseDTO } from '../../../../core/models/recepcion.model';
import { HabitacionResponseDTO } from '../../../../core/models/Habitacion';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiResponse } from '../../../../core/models/ApiResponse';

const TIMEOUT_CARGA_MS = 30000;

@Component({
  selector: 'app-cliente-historial-habitaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-historial.html',
  styleUrls: ['./cliente-historial.scss']
})
export class ClienteHistorialHabitacionesComponent implements OnInit {
  private readonly recepcionService = inject(RecepcionService);
  private readonly habitacionService = inject(HabitacionService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals para manejar el historial y el estado de carga
  readonly historialHabitaciones = signal<RecepcionResponseDTO[]>([]);
  readonly isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarHistorialCliente();
  }

  private cargarHistorialCliente(): void {
    const idPersonaString = this.authService.getUserId();
    const idPersona = idPersonaString ? Number(idPersonaString) : NaN;

    if (!Number.isFinite(idPersona) || idPersona <= 0) {
      Swal.fire('Error', 'No se pudo identificar el usuario. Inicia sesión nuevamente.', 'error');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    // Consultamos en paralelo las recepciones del cliente y la lista general de habitaciones para cruzar el número
    forkJoin({
      recepcionesRes: this.recepcionService.listarPorCliente(idPersona),
      habitacionesRes: this.habitacionService.listar()
    })
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: ({ recepcionesRes, habitacionesRes }) => {
          const listaRecepciones = recepcionesRes?.data ?? [];
          const listaHabitaciones = habitacionesRes?.data ?? [];

          // Creamos un mapa rápido ID_Habitacion -> Numero_Habitacion para un acceso eficiente
          const mapaHabitaciones = new Map<number, string>();
          listaHabitaciones.forEach((h: HabitacionResponseDTO) => {
            if (h.idHabitacion != null && h.numero != null) {
              mapaHabitaciones.set(h.idHabitacion, h.numero);
            }
          });

          // Cruzamos los datos para inyectar el número de habitación si faltaba
          const listaEnriquecida: RecepcionResponseDTO[] = listaRecepciones.map(item => ({
            ...item,
            numeroHabitacion: item.numeroHabitacion || mapaHabitaciones.get(item.idHabitacion) || 'N/A'
          }));

          // Ordenar del más reciente al más antiguo según la fecha de entrada
          const historialOrdenado = listaEnriquecida.sort((a, b) =>
            new Date(b.fechaEntrada).getTime() - new Date(a.fechaEntrada).getTime()
          );

          this.historialHabitaciones.set(historialOrdenado);
        },
        error: (err: unknown) => {
          console.error('Error al cargar el historial o habitaciones:', err);
          Swal.fire('Error', 'No se pudo cargar tu historial de habitaciones.', 'error');
        }
      });
  }

  trackById(index: number, item: RecepcionResponseDTO): number {
    return item.idRecepcion ?? index;
  }
}
