import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { HabitacionResponseDTO } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';

@Component({
  selector: 'app-listahabitacionesocupadas',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './listahabitacionesocupadas.html',
  styleUrls: ['./listahabitacionesocupadas.css']
})
export class ListaHabitacionesEstadoComponent implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pisoService = inject(PisoService);

  // Signals utilizando la interfaz correcta HabitacionResponseDTO
  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  estadoFiltro = signal<number>(2);
  isLoading = signal<boolean>(false);

  // Computado para filtrado reactivo utilizando la relación anidada .piso.idPiso
  readonly habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.piso?.idPiso) === pId);
  });

  ngOnInit(): void {
    this.estadoFiltro.set(Number(this.route.snapshot.data['tipoEstado']) || 2);
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.isLoading.set(true);

    // Solo cargamos pisos y habitaciones, ya que los DTOs ya traen anidados categoría y estado
    forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar()
    }).subscribe({
      next: ({ pisos, habitaciones }) => {
        this.pisos.set(pisos.data ?? []);

        const estadoTarget = this.estadoFiltro();

        // Filtramos directamente consultando el id del objeto anidado estadoHabitacion
        const listaFiltrada = (habitaciones.data ?? []).filter(h =>
          Number(h.estadoHabitacion?.idEstadoHabitacion) === estadoTarget && h.estado !== false
        );

        this.habitaciones.set(listaFiltrada);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if ([401, 403].includes(err.status)) {
          this.manejarExpiracionSesion();
        } else {
          Swal.fire('Error', 'No se pudieron recuperar los datos.', 'error');
        }
      }
    });
  }

  trackByHabitacion(index: number, h: HabitacionResponseDTO): number {
    return h.idHabitacion!;
  }

  irAVenta(id?: number): void {
    if (id) this.router.navigate(['/admin/ventaproductos', id]);
  }

  private manejarExpiracionSesion(): void {
    Swal.fire('Sesión Caducada', 'Inicia sesión nuevamente.', 'error')
      .then(() => this.router.navigate(['/login']));
  }

  onPisoChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.idPisoSeleccionado.set(Number(selectElement.value));
  }
}
