import { Component, OnInit, inject, signal, computed, NgZone, DestroyRef } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, TimeoutError, filter, finalize, forkJoin, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { HabitacionResponseDTO } from '../../core/models/Habitacion';
import { Piso } from '../../core/models/piso';
import { Categoria } from '../../core/models/categoria.model';

const TIMEOUT_CARGA_MS = 30000;

const ERRORES_HTTP: Record<number, { titulo: string; texto: string; icono: SweetAlertIcon }> = {
  400: { titulo: 'Validación de Negocio', texto: 'La habitación ya cuenta con una recepción activa o los datos son incorrectos.', icono: 'warning' },
  409: { titulo: 'Operación en progreso', texto: 'La habitación tiene una operación en curso.', icono: 'warning' },
  412: { titulo: 'Conflicto de versión', texto: 'La información cambió en el servidor. Recargue la página.', icono: 'error' }
};

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [NgClass, FormsModule, DecimalPipe],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.css']
})
export class RecepcionComponent implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  habitaciones = signal<HabitacionResponseDTO[]>([]);
  pisos = signal<Piso[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal<boolean>(false);

  private cargaSub?: Subscription;
  private refrescoSub?: Subscription;
  private ultimaFirma = '';
  // El NavigationEnd de la navegación que creó este componente ya la cubre ngOnInit.
  private omitirNavegacionInicial = true;

  habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => h.piso?.idPiso === pId);
  });

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((event) => {
      if (this.omitirNavegacionInicial) {
        this.omitirNavegacionInicial = false;
        return;
      }
      if (event.url.includes('/admin/recepcion') && !event.url.includes('detalle')) {
        this.actualizarAhora();
      }
    });
  }

  ngOnInit(): void {
    this.cargarDatos();
    this.iniciarSseTiempoReal();
  }

  cargarDatos(): void {
    // Cancela cualquier carga/refresco previo para no acumular conexiones abiertas.
    this.cargaSub?.unsubscribe();
    this.refrescoSub?.unsubscribe();
    this.isLoading.set(true);

    this.cargaSub = forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar()
    })
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef), // al salir de la pantalla se cancelan las peticiones
        finalize(() => this.isLoading.set(false)) // se apaga en éxito, error, timeout o cancelación
      )
      .subscribe({
        next: ({ pisos, habitaciones }) => {
          this.pisos.set(pisos.data ?? []);
          this.aplicarHabitaciones(habitaciones.data ?? []);
        },
        error: (err: unknown) => this.mostrarError(err, 'Error al cargar datos de recepción')
      });
  }

  private iniciarSseTiempoReal(): void {
    if (typeof window === 'undefined') return;

    this.habService.obtenerCambiosTiempoReal()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (habitacionModificada) => {
          this.ngZone.run(() => {
            // Fuerza que el próximo refresco por HTTP siempre se aplique.
            this.ultimaFirma = '';
            this.habitaciones.update(listaActual => {
              if (habitacionModificada.estado === false) {
                return listaActual.filter(h => h.idHabitacion !== habitacionModificada.idHabitacion);
              }

              const index = listaActual.findIndex(h => h.idHabitacion === habitacionModificada.idHabitacion);
              if (index !== -1) {
                const nuevaLista = [...listaActual];
                nuevaLista[index] = habitacionModificada;
                return nuevaLista;
              }
              return [habitacionModificada, ...listaActual];
            });
          });
        },
        error: (err: unknown) => console.error('Error en SSE de recepción:', err)
      });
  }

  actualizarAhora(): void {
    if (this.isLoading()) return; // ya hay una carga completa en curso
    this.refrescoSub?.unsubscribe();

    this.refrescoSub = this.habService.listar()
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res) => this.aplicarHabitaciones(res.data ?? []),
        error: (err: unknown) => this.mostrarError(err, 'Error al actualizar habitaciones')
      });
  }

  private aplicarHabitaciones(lista: HabitacionResponseDTO[]): void {
    const ordenada = lista
      .filter(h => h.estado !== false) // las habitaciones dadas de baja no se muestran
      .sort((a, b) => b.idHabitacion - a.idHabitacion);
    const firma = JSON.stringify(ordenada);
    if (firma === this.ultimaFirma) return;
    this.ultimaFirma = firma;
    this.habitaciones.set(ordenada);
  }

  getCatNombre(categoria: Categoria | null | undefined): string {
    return categoria?.descripcion || 'N/A';
  }

  getPisoNombre(piso: Piso | null | undefined): string {
    return piso?.descripcion || 'Piso ' + (piso?.idPiso ?? '');
  }

  getEstNombre(habitacion: HabitacionResponseDTO): string {
    return habitacion?.estadoHabitacion?.descripcion || 'Disponible';
  }

  abrirDetalle(habitacion: HabitacionResponseDTO): void {
    this.router.navigate(['/admin/recepciondetalle', habitacion.idHabitacion]);
  }

  private mostrarError(err: unknown, mensajePorDefecto: string): void {
    if (err instanceof TimeoutError) {
      Swal.fire('Tiempo agotado', 'El servidor tardó demasiado en responder. Intenta nuevamente.', 'warning');
      return;
    }

    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        Swal.fire('Sin conexión', 'No se pudo comunicar con el servidor.', 'error');
        return;
      }
      const conocido = ERRORES_HTTP[err.status];
      if (conocido) {
        Swal.fire(conocido.titulo, conocido.texto, conocido.icono);
        return;
      }
      const errorBody = err.error as { message?: string } | string | null;
      const detalle = typeof errorBody === 'object' && errorBody !== null
        ? errorBody.message
        : (typeof errorBody === 'string' ? errorBody : null);
      Swal.fire('Error', detalle || mensajePorDefecto, 'error');
      return;
    }

    Swal.fire('Error', mensajePorDefecto, 'error');
  }
}
