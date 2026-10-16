import { Component, OnInit, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { Habitacion } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';

@Component({
  selector: 'app-listahabitacionesocupadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listahabitacionesocupadas.html',
  styleUrls: ['./listahabitacionesocupadas.css']
})
export class ListaHabitacionesEstadoComponent implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pisoService = inject(PisoService);
  private readonly catService = inject(CategoriaService);
  private readonly estService = inject(EstadoHabitacionService);

  // Signals
  habitaciones = signal<Habitacion[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  estadoFiltro = signal<number>(2);
  isLoading = signal<boolean>(false);

  // Computado para filtrado reactivo
  readonly habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.idPiso) === pId);
  });

  ngOnInit(): void {
    this.estadoFiltro.set(Number(this.route.snapshot.data['tipoEstado']) || 2);
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.isLoading.set(true);

    forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar(),
      categorias: this.catService.listar(),
      estados: this.estService.listar()
    }).subscribe({
      next: ({ pisos, habitaciones, categorias, estados }) => {
        this.pisos.set(pisos.data ?? []);

        const cats = categorias.data ?? [];
        const ests = estados.data ?? [];

        // Mapeo enriquecido para el template
        this.habitaciones.set((habitaciones.data ?? [])
          .filter(h => Number(h.idEstadoHabitacion) === this.estadoFiltro() && h.estado !== false)
          .map(h => ({
            ...h,
            categoriaNombre: cats.find(c => Number(c.idCategoria) === Number(h.idCategoria))?.descripcion ?? 'Sin categoría',
            estadoDescripcion: ests.find(e => Number(e.idEstadoHabitacion) === Number(h.idEstadoHabitacion))?.descripcion ?? 'N/A'
          }))
        );
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

  trackByHabitacion(index: number, h: Habitacion): number {
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
