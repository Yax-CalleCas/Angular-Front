import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { forkJoin, Subscription, filter } from 'rxjs';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { HabitacionResponseDTO } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.css']
})
export class RecepcionComponent implements OnInit, OnDestroy {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly catService = inject(CategoriaService);
  private readonly estService = inject(EstadoHabitacionService);

  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal(false);

  private catsMap = new Map<number, string>();
  private estsMap = new Map<number, string>();
  private routerSubscription?: Subscription;

  habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => {
          const pisoId = typeof h.piso === 'object' ? h.piso?.idPiso : Number(h.piso);
          return pisoId === pId;
        });
  });

  ngOnInit(): void {
    this.cargarDatos();

    // 🔄 Detectar cuando el usuario regresa a esta ruta para refrescar la data automáticamente
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url.includes('/admin/recepcion') && !event.url.includes('detalle')) {
        this.refrescarDatosSilencioso();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
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

        this.catsMap = new Map((categorias.data ?? []).map(c => [Number(c.idCategoria), c.descripcion]));
        this.estsMap = new Map((estados.data ?? []).map(e => [Number(e.idEstadoHabitacion), e.descripcion]));

        this.habitaciones.set(habitaciones.data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos de recepción:', err);
        this.isLoading.set(false);
      }
    });
  }

  getCatNombre(categoria: any): string {
    if (!categoria) return 'N/A';
    if (typeof categoria === 'object') {
      return categoria.descripcion || 'N/A';
    }
    return this.catsMap.get(Number(categoria)) ?? 'N/A';
  }

  getPisoNombre(piso: any): string {
    if (!piso) return 'N/A';
    if (typeof piso === 'object') {
      return piso.descripcion || 'N/A';
    }
    return 'Piso ' + piso;
  }

  getEstNombre(habitacion: HabitacionResponseDTO): string {
    if (!habitacion || !habitacion.estadoHabitacion) return 'Disponible';
    if (typeof habitacion.estadoHabitacion === 'object') {
      return habitacion.estadoHabitacion.descripcion || 'Disponible';
    }
    return this.estsMap.get(Number(habitacion.estadoHabitacion)) ?? 'Disponible';
  }

  abrirDetalle(habitacion: HabitacionResponseDTO): void {
    this.router.navigate(['/admin/recepciondetalle', habitacion.idHabitacion]);
  }

  refrescarDatos(): void {
    this.habService.listar().subscribe({
      next: (res) => {
        this.habitaciones.set(res.data ?? []);
      },
      error: (err) => console.error('Error al refrescar habitaciones:', err)
    });
  }

  // Refresco rápido y silencioso en segundo plano sin mostrar spinners pesados
  private refrescarDatosSilencioso(): void {
    this.habService.listar().subscribe({
      next: (res) => {
        this.habitaciones.set(res.data ?? []);
      },
      error: (err) => console.error('Error en actualización automática:', err)
    });
  }
}
