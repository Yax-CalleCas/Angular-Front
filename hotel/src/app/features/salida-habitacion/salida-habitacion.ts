import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

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

  // Signals utilizando la interfaz HabitacionResponseDTO
  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal<boolean>(false);

  // Computado para filtrado reactivo utilizando la relación anidada .piso.idPiso
  readonly habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.piso?.idPiso) === pId);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.isLoading.set(true);

    // Cargamos pisos y habitaciones de forma eficiente en paralelo
    forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar()
    }).subscribe({
      next: ({ pisos, habitaciones }) => {
        this.pisos.set(pisos.data ?? []);

        // El estado ID 2 corresponde a las habitaciones OCUPADAS
        const estadoOcupadoTarget = 2;

        // Filtramos consultando el ID del objeto anidado estadoHabitacion
        const listaOcupadas = (habitaciones.data ?? []).filter(h =>
          Number(h.estadoHabitacion?.idEstadoHabitacion) === estadoOcupadoTarget && h.estado !== false
        );

        this.habitaciones.set(listaOcupadas);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if ([401, 403].includes(err.status)) {
          this.manejarExpiracionSesion();
        } else {
          Swal.fire('Error', 'No se pudieron recuperar las habitaciones ocupadas.', 'error');
        }
      }
    });
  }

  trackByHabitacion(index: number, h: HabitacionResponseDTO): number {
    return h.idHabitacion!;
  }

  procesarSalidaVenta(h: HabitacionResponseDTO): void {
    if (!h.idHabitacion) return;
    // Navega al componente procesar salida pasando el ID de la habitación
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
