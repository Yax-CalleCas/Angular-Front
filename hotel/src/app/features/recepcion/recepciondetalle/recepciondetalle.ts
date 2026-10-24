import { Component, OnInit, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, finalize, forkJoin, switchMap, tap, timeout } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../../core/services/habitacion.service';
import { RecepcionService } from '../../../core/services/recepcion.service';
import { PersonaService } from '../../../core/services/persona.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { PisoService } from '../../../core/services/piso.service';
import { EstadoHabitacionService } from '../../../core/services/EstadoHabitacionService';
import { HabitacionResponseDTO } from '../../../core/models/Habitacion';
import { Persona } from '../../../core/models/persona.model';
import { RecepcionResponseDTO, RecepcionRequestDTO } from '../../../core/models/recepcion.model';

const ID_TIPO_PERSONA_CLIENTE = 3;
const ID_ESTADO_OCUPADO = 2;
const ID_ESTADO_MANTENIMIENTO = 3;
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const TIMEOUT_CARGA_MS = 30000;

interface BootstrapModalInstance {
  show(): void;
  hide(): void;
}

interface BootstrapGlobal {
  Modal: {
    getOrCreateInstance(element: HTMLElement): BootstrapModalInstance;
    getInstance(element: HTMLElement): BootstrapModalInstance | null;
  };
}

const bootstrapGlobal = (): BootstrapGlobal | undefined =>
  (window as unknown as { bootstrap?: BootstrapGlobal }).bootstrap;

@Component({
  selector: 'app-recepciondetalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recepciondetalle.html'
})
export class RecepcionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly habService = inject(HabitacionService);
  private readonly recService = inject(RecepcionService);
  private readonly personaService = inject(PersonaService);
  private readonly catService = inject(CategoriaService);
  private readonly pisoService = inject(PisoService);
  private readonly estService = inject(EstadoHabitacionService);

  private habitacionSub?: Subscription;
  private recepcionActivaSub?: Subscription;

  habitacion = signal<HabitacionResponseDTO | null>(null);
  recepcion = signal<RecepcionResponseDTO>(this.inicializarModelo());
  listaPersonas = signal<Persona[]>([]);
  paginaActual = signal<number>(0);
  itemsPorPagina = 5;

  catMap = signal<Map<number, string>>(new Map());
  pisoMap = signal<Map<number, string>>(new Map());
  estMap = signal<Map<number, string>>(new Map());
  catalogosListos = signal(false);

  noches = signal<number>(1);
  dniBusqueda = signal('');
  guardando = signal(false);

  // Validación de estado Ocupado
  esOcupada = computed(() => {
    const hab = this.habitacion();
    if (!hab || !hab.estadoHabitacion) return false;
    const estId = this.extraerId(hab.estadoHabitacion, 'idEstadoHabitacion');
    const nombreEstado = (this.estMap().get(estId) || '').toLowerCase();
    return estId === ID_ESTADO_OCUPADO || nombreEstado.includes('ocupado');
  });

  // Validación de estado Mantenimiento
  esMantenimiento = computed(() => {
    const hab = this.habitacion();
    if (!hab || !hab.estadoHabitacion) return false;
    const estId = this.extraerId(hab.estadoHabitacion, 'idEstadoHabitacion');
    const nombreEstado = (this.estMap().get(estId) || '').toLowerCase();
    return estId === ID_ESTADO_MANTENIMIENTO || nombreEstado.includes('mantenimiento') || nombreEstado.includes('limpieza');
  });

  private readonly clientesActivos = computed(() =>
    this.listaPersonas().filter(p => p.estado === true)
  );

  personasPaginadas = computed(() => {
    const inicio = this.paginaActual() * this.itemsPorPagina;
    return this.clientesActivos().slice(inicio, inicio + this.itemsPorPagina);
  });

  totalPaginas = computed(() =>
    Math.ceil(this.clientesActivos().length / this.itemsPorPagina)
  );

  // Datos del cliente seleccionado o del ocupante actual
  cliente = computed(() => {
    const idCliente = this.recepcion().idCliente;
    if (!idCliente) return null;
    return this.listaPersonas().find(p => p.idPersona === idCliente) || null;
  });

  ngOnInit(): void {
    // Primero catálogos y clientes; luego se lee la ruta (y se reacciona a cambios de :id)
    // dentro de la misma cadena, para que todo se cancele al salir de la pantalla.
    forkJoin({
      cats: this.catService.listar(),
      pisos: this.pisoService.listar(),
      estados: this.estService.listar(),
      personas: this.personaService.listar()
    })
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        tap(({ cats, pisos, estados, personas }) => {
          this.catMap.set(new Map((cats.data ?? []).map(c => [Number(c.idCategoria), c.descripcion])));
          this.pisoMap.set(new Map((pisos.data ?? []).map(p => [Number(p.idPiso), p.descripcion])));
          this.estMap.set(new Map((estados.data ?? []).map(e => [Number(e.idEstadoHabitacion), e.descripcion])));

          const clientes = (personas ?? []).filter(
            (p: Persona) => Number(p.idTipoPersona) === ID_TIPO_PERSONA_CLIENTE && p.estado === true
          );
          this.listaPersonas.set(clientes);
          this.catalogosListos.set(true);
        }),
        switchMap(() => this.route.paramMap),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: params => {
          const id = Number(params.get('id'));
          if (id) this.cargarDatosHabitacion(id);
        },
        error: (err: unknown) => {
          console.error('Error al cargar catálogos iniciales:', err);
          Swal.fire('Error', 'No se pudieron cargar los catálogos del sistema', 'error');
        }
      });
  }

  private inicializarModelo(): RecepcionResponseDTO {
    const hoy = this.hoyLocal();
    const manana = this.sumarDiasLocal(new Date(), 1);
    return {
      idRecepcion: 0,
      idCliente: 0,
      idHabitacion: 0,
      fechaEntrada: hoy,
      fechaSalida: manana,
      fechaSalidaConfirmacion: null,
      precioInicial: 0,
      adelanto: 0,
      precioRestante: 0,
      totalPagado: 0,
      costoPenalidad: 0,
      observacion: '',
      estado: true,
      fechaCreacion: hoy
    };
  }

  private hoyLocal(): string {
    return this.formatearFecha(new Date());
  }

  private sumarDiasLocal(fecha: Date, dias: number): string {
    const d = new Date(fecha);
    d.setDate(d.getDate() + dias);
    return this.formatearFecha(d);
  }

  private formatearFecha(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  public soloFecha(valor: unknown): string {
    return String(valor ?? '').substring(0, 10);
  }

  /** El campo puede venir como objeto anidado ({ idX: 1 }) o como id plano. */
  private extraerId(valor: unknown, campo: string): number {
    if (valor && typeof valor === 'object') {
      return Number((valor as Record<string, unknown>)[campo]) || 0;
    }
    return Number(valor) || 0;
  }

  private calcularNoches(): number {
    const r = this.recepcion();
    const entrada = new Date(this.soloFecha(r.fechaEntrada)).getTime();
    const salida = new Date(this.soloFecha(r.fechaSalida)).getTime();
    if (Number.isNaN(entrada) || Number.isNaN(salida)) return 0;
    return Math.max(0, Math.round((salida - entrada) / MS_POR_DIA));
  }

  cambiarPagina(nuevaPagina: number): void {
    const max = Math.max(0, this.totalPaginas() - 1);
    this.paginaActual.set(Math.min(Math.max(0, nuevaPagina), max));
  }

  abrirModalClientes(): void {
    if (this.esOcupada() || this.esMantenimiento()) return;
    const modalElement = document.getElementById('modalClientes');
    const bootstrap = bootstrapGlobal();
    if (modalElement && bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
  }

  private cerrarModalClientes(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    const modalElement = document.getElementById('modalClientes');
    if (modalElement) {
      bootstrapGlobal()?.Modal.getInstance(modalElement)?.hide();
    }
  }

  cargarDatosHabitacion(idHabitacion: number): void {
    this.habitacionSub?.unsubscribe();
    this.recepcionActivaSub?.unsubscribe();

    this.habitacionSub = this.habService.buscarPorId(idHabitacion)
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: res => {
          const hab = res.data;
          if (!hab) {
            Swal.fire('Error', 'No se encontró la habitación solicitada', 'error')
              .then(() => this.router.navigate(['/admin/recepcion']));
            return;
          }
          this.habitacion.set(hab);

          if (this.esMantenimiento()) {
            Swal.fire('Acceso Restringido', 'La habitación se encuentra en mantenimiento y no permite operaciones.', 'error')
              .then(() => this.router.navigate(['/admin/recepcion']));
            return;
          }

          if (this.esOcupada()) {
            this.recepcionActivaSub = this.recService.buscarActivaPorHabitacion(idHabitacion)
              .pipe(
                timeout(TIMEOUT_CARGA_MS),
                takeUntilDestroyed(this.destroyRef)
              )
              .subscribe({
                next: recRes => {
                  const recData = recRes.data;
                  if (recData) {
                    this.recepcion.set(recData);
                  }
                },
                error: () => console.warn('No se pudo recuperar el detalle de la recepción activa.')
              });
          } else {
            this.recepcion.update(r => ({ ...r, idHabitacion, precioInicial: hab.precio }));
            this.calcularTotal();
          }
        },
        error: (err: unknown) => {
          console.error('Error al cargar la habitación:', err);
          Swal.fire('Error', 'No se pudo cargar la información de la habitación', 'error');
        }
      });
  }

  calcularTotal(): void {
    if (this.esOcupada()) return;

    const hab = this.habitacion();
    if (!hab) return;

    const noches = Math.max(1, this.calcularNoches());
    this.noches.set(noches);

    const total = noches * (hab.precio || 0);
    const adelanto = Number(this.recepcion().adelanto) || 0;

    this.recepcion.update(r => ({
      ...r,
      precioInicial: total,
      totalPagado: Math.min(adelanto, total),
      precioRestante: Math.max(0, total - adelanto)
    }));
  }

  guardar(): void {
    if (this.esOcupada() || this.esMantenimiento()) {
      Swal.fire('Acción no permitida', 'No se puede registrar una reserva en una habitación ocupada o en mantenimiento.', 'warning');
      return;
    }

    if (this.guardando()) return;

    const r = this.recepcion();

    if (r.idCliente == null || r.idCliente === 0) {
      Swal.fire('Error', 'Debe seleccionar un cliente antes de registrar', 'error');
      return;
    }
    if (r.idHabitacion == null || r.idHabitacion === 0) {
      Swal.fire('Error', 'No se ha identificado la habitación', 'error');
      return;
    }
    if (this.calcularNoches() < 1) {
      Swal.fire('Error', 'La fecha de salida debe ser posterior a la de entrada', 'error');
      return;
    }

    const payload: RecepcionRequestDTO = {
      idCliente: r.idCliente,
      idHabitacion: r.idHabitacion,
      fechaEntrada: this.soloFecha(r.fechaEntrada),
      fechaSalida: this.soloFecha(r.fechaSalida),
      precioInicial: Number(r.precioInicial) || 0,
      adelanto: Number(r.adelanto) || 0,
      observacion: r.observacion?.trim() || undefined
    };

    this.guardando.set(true);
    // No se cancela al destruir el componente: un registro en curso debe terminar.
    this.recService.registrar(payload)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          Swal.fire('Éxito', 'Check-in (Recepción) registrado correctamente', 'success');
          this.router.navigate(['/admin/recepcion']);
        },
        error: (err: unknown) => {
          Swal.fire('Error', this.mensajeError(err, 'Error al registrar la recepción'), 'error');
        }
      });
  }

  seleccionarPersona(c: Persona): void {
    if (this.esOcupada() || c.idPersona == null) return;
    const idPersona = c.idPersona;
    this.recepcion.update(r => ({
      ...r,
      idCliente: idPersona
    }));
    this.cerrarModalClientes();
  }

  buscarCliente(): void {
    if (this.esOcupada()) return;
    const busqueda = this.dniBusqueda().trim();
    const cliente = this.listaPersonas().find(p => p.documento?.toString().trim() === busqueda);

    if (cliente) {
      this.seleccionarPersona(cliente);
    } else {
      Swal.fire('Atención', 'Cliente no encontrado en la lista de clientes activos', 'warning');
    }
  }

  getCatNombre(id: number): string {
    return this.catMap().get(Number(id)) ?? (this.catalogosListos() ? 'N/D' : 'Cargando...');
  }

  getPisoNombre(id: number): string {
    return this.pisoMap().get(Number(id)) ?? (this.catalogosListos() ? 'N/D' : 'Cargando...');
  }

  getHabitacionCategoriaId(): number {
    const hab = this.habitacion();
    return hab ? this.extraerId(hab.categoria, 'idCategoria') : 0;
  }

  getHabitacionPisoId(): number {
    const hab = this.habitacion();
    return hab ? this.extraerId(hab.piso, 'idPiso') : 0;
  }

  actualizarAdelanto(valor: unknown): void {
    if (this.esOcupada()) return;
    const adelanto = Number(valor) || 0;
    this.recepcion.update(r => ({ ...r, adelanto }));
    this.calcularTotal();
  }

  private mensajeError(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | string | null;
      if (body && typeof body === 'object' && body.message) return body.message;
    }
    return porDefecto;
  }
}
