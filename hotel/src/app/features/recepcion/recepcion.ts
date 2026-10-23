import { Component, OnInit, OnDestroy, inject, signal, computed, NgZone } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { HabitacionResponseDTO, EstadoHabitacionResponseDTO } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';
import { Categoria } from '../../core/models/categoria.model';

const ERRORES_HTTP: Record<number, { titulo: string; texto: string; icono: SweetAlertIcon }> = {
  409: {
    titulo: 'Operación en progreso',
    texto: 'La habitación tiene una operación en curso. Intenta nuevamente en unos minutos.',
    icono: 'warning'
  },
  412: {
    titulo: 'Conflicto de versión',
    texto: 'La información cambió en el servidor. Por favor recargue la página.',
    icono: 'error'
  }
};

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.css']
})
export class RecepcionComponent implements OnInit, OnDestroy {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly catService = inject(CategoriaService);
  private readonly estService = inject(EstadoHabitacionService);
  private readonly ngZone = inject(NgZone);

  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal(false);

  private catsMap = new Map<number, string>();
  private estsMap = new Map<number, string>();
  private routerSubscription?: Subscription;
  private ultimaFirma = '';

  habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => {
          const pisoId = h.piso?.idPiso;
          return pisoId === pId;
        });
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.iniciarSseTiempoReal();

    this.routerSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      if (event.url.includes('/admin/recepcion') && !event.url.includes('detalle')) {
        this.actualizarAhora();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
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
        this.catsMap = new Map(((categorias.data ?? []) as Categoria[]).map(c => [Number(c.idCategoria), c.descripcion]));
        this.estsMap = new Map(((estados.data ?? []) as EstadoHabitacionResponseDTO[]).map(e => [Number(e.idEstadoHabitacion), e.descripcion]));
        this.aplicarHabitaciones(habitaciones.data ?? []);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.mostrarError(err, 'Error al cargar datos de recepción');
        this.isLoading.set(false);
      }
    });
  }

  private iniciarSseTiempoReal(): void {
    if (typeof window === 'undefined') return;

    this.habService.obtenerCambiosTiempoReal()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (habitacionModificada) => {
          this.ngZone.run(() => {
            this.habitaciones.update(listaActual => {
              const index = listaActual.findIndex(h => h.idHabitacion === habitacionModificada.idHabitacion);
              if (index !== -1) {
                const nuevaLista = [...listaActual];
                nuevaLista[index] = habitacionModificada;
                return nuevaLista;
              } else {
                return [habitacionModificada, ...listaActual];
              }
            });
          });
        },
        error: (err: unknown) => console.error('Error en el flujo SSE de recepción:', err)
      });
  }

  actualizarAhora(): void {
    this.habService.listar().subscribe({
      next: (res) => this.aplicarHabitaciones(res.data ?? []),
      error: (err: HttpErrorResponse) => this.mostrarError(err, 'Error al actualizar habitaciones')
    });
  }

  private aplicarHabitaciones(lista: HabitacionResponseDTO[]): void {
    const ordenada = [...lista].sort((a, b) => b.idHabitacion - a.idHabitacion);
    const firma = JSON.stringify(ordenada);
    if (firma === this.ultimaFirma) return;
    this.ultimaFirma = firma;
    this.habitaciones.set(ordenada);
  }

  getCatNombre(categoria: Categoria | null | undefined): string {
    if (!categoria) return 'N/A';
    return categoria.descripcion || 'N/A';
  }

  getPisoNombre(piso: Piso | null | undefined): string {
    if (!piso) return 'N/A';
    return piso.descripcion || 'Piso ' + piso.idPiso;
  }

  getEstNombre(habitacion: HabitacionResponseDTO): string {
    if (!habitacion || !habitacion.estadoHabitacion) return 'Disponible';
    return habitacion.estadoHabitacion.descripcion || 'Disponible';
  }

  abrirDetalle(habitacion: HabitacionResponseDTO): void {
    this.router.navigate(['/admin/recepciondetalle', habitacion.idHabitacion]);
  }

  private mostrarError(err: HttpErrorResponse, mensajePorDefecto: string): void {
    const conocido = ERRORES_HTTP[err.status];
    if (conocido) {
      Swal.fire(conocido.titulo, conocido.texto, conocido.icono);
      return;
    }
    const errorBody = err.error as { message?: string } | string | null;
    const detalle = typeof errorBody === 'object' && errorBody !== null ? errorBody.message : (typeof errorBody === 'string' ? errorBody : null);
    Swal.fire('Error', detalle || mensajePorDefecto, 'error');
  }
}
