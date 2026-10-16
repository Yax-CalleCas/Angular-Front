import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { Habitacion } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';

@Component({
  selector: 'app-salida-habitacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salida-habitacion.html',
    styleUrls:['./salida-habitacion.css']

})
export class SalidaHabitacion implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly catService = inject(CategoriaService);
  private readonly estService = inject(EstadoHabitacionService);

  // Signals
  habitaciones = signal<Habitacion[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal(false);

  // Computado: Filtrado automático sin llamar a funciones en el template
  habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.idPiso) === pId);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
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

        this.habitaciones.set((habitaciones.data ?? [])
          .filter(h => Number(h.idEstadoHabitacion) === 2)
          .map(h => ({
            ...h,
            categoriaNombre: cats.find(c => Number(c.idCategoria) === Number(h.idCategoria))?.descripcion ?? 'N/A',
            estadoDescripcion: ests.find(e => Number(e.idEstadoHabitacion) === Number(h.idEstadoHabitacion))?.descripcion ?? 'Ocupado'
          }))
        );
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if ([401, 403].includes(err.status)) this.manejarExpiracionSesion();
        else Swal.fire('Error', 'No se pudieron recuperar los datos.', 'error');
      }
    });
  }

  trackByHabitacion(index: number, h: Habitacion): number {
    return h.idHabitacion!;
  }

  procesarSalidaVenta(h: Habitacion): void {
    if (!h.idHabitacion) return;
    this.router.navigate(['/admin/procesarsalida', h.idHabitacion]);
  }


  private manejarExpiracionSesion(): void {
    Swal.fire('Sesión Caducada', 'Inicia sesión nuevamente.', 'error').then(() => this.router.navigate(['/login']));
  }
}
