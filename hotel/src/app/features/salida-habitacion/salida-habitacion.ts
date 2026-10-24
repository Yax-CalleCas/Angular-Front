import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { finalize, forkJoin } from 'rxjs';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { HabitacionResponseDTO } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';

@Component({
  selector: 'app-salida-habitacion',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './salida-habitacion.html',
  styleUrls: ['./salida-habitacion.css']
})
export class SalidaHabitacion implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly destroyRef = inject(DestroyRef); // <-- Inyección del contexto de destrucción para evitar NG0203

  // Signals utilizando la interfaz HabitacionResponseDTO[cite: 14]
  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal<boolean>(false);

  // Computado para filtrado reactivo utilizando la relación anidada .piso.idPiso[cite: 14]
  readonly habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.piso?.idPiso) === pId);
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.iniciarSseTiempoReal();
  }

  private cargarDatos(): void {
    this.isLoading.set(true);

    // Cargamos pisos y habitaciones en paralelo de manera eficiente con blindaje finalize
    forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar()
    })
      .pipe(finalize(() => this.isLoading.set(false))) // <-- Garantiza que el loader siempre se apague
      .subscribe({
        next: ({ pisos, habitaciones }) => {
          this.pisos.set(pisos.data ?? []);
          this.procesarHabitacionesOcupadas(habitaciones.data ?? []);
        },
        error: (err) => {
          if ([401, 403].includes(err.status)) {
            this.manejarExpiracionSesion();
          } else {
            Swal.fire('Error', 'No se pudieron recuperar las habitaciones ocupadas.', 'error');
          }
        }
      });
  }
  /**
   * Filtra las habitaciones aplicando la regla de negocio del backend:
   * Verifica si el código es 'OCUPADA' (o ID 2 como respaldo) y que la habitación esté activa.[cite: 14]
   */
  private procesarHabitacionesOcupadas(lista: HabitacionResponseDTO[]): void {
    const listaOcupadas = lista.filter(h => {
      const codigoEstado = h.estadoHabitacion?.codigo?.toUpperCase();
      const idEstado = Number(h.estadoHabitacion?.idEstadoHabitacion);
      const esOcupada = codigoEstado === 'OCUPADA' || idEstado === 2;
      return esOcupada && h.estado !== false;
    });

    this.habitaciones.set(listaOcupadas);
  }

  /**
   * Sincronización en tiempo real vía SSE para reflejar check-outs o cambios de estado al instante.[cite: 14]
   */
  private iniciarSseTiempoReal(): void {
    if (typeof window === 'undefined') return;

    this.habService.obtenerCambiosTiempoReal()
      .pipe(takeUntilDestroyed(this.destroyRef)) // <-- Se pasa el destroyRef explícitamente aquí
      .subscribe({
        next: (habitacionModificada) => {
          this.habitaciones.update(listaActual => {
            const codigoEstado = habitacionModificada.estadoHabitacion?.codigo?.toUpperCase();
            const idEstado = Number(habitacionModificada.estadoHabitacion?.idEstadoHabitacion);
            const sigueOcupada = (codigoEstado === 'OCUPADA' || idEstado === 2) && habitacionModificada.estado !== false;

            const index = listaActual.findIndex(h => h.idHabitacion === habitacionModificada.idHabitacion);

            if (sigueOcupada) {
              if (index !== -1) {
                const nuevaLista = [...listaActual];
                nuevaLista[index] = habitacionModificada;
                return nuevaLista;
              } else {
                return [habitacionModificada, ...listaActual];
              }
            } else {
              // Si la habitación ya hizo check-out (cambió a limpieza/disponible), se elimina de la lista de salidas[cite: 14]
              if (index !== -1) {
                return listaActual.filter(h => h.idHabitacion !== habitacionModificada.idHabitacion);
              }
            }
            return listaActual;
          });
        },
        error: (err) => console.error('Error en el flujo SSE de SalidaHabitacion:', err)
      });
  }

  trackByHabitacion(index: number, h: HabitacionResponseDTO): number {
    return h.idHabitacion!;
  }

  procesarSalidaVenta(h: HabitacionResponseDTO): void {
    if (!h.idHabitacion) return;
    this.router.navigate(['/admin/procesarsalida', h.idHabitacion]);
  }

  onPisoChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.idPisoSeleccionado.set(Number(selectElement.value));
  }

  private manejarExpiracionSesion(): void {
    Swal.fire('Sesión Caducada', 'Inicia sesión nuevamente.', 'error')
      .then(() => this.router.navigate(['/login']));
  }
}
