import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
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
const MS_POR_DIA = 1000 * 60 * 60 * 24;

@Component({
  selector: 'app-recepciondetalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './recepciondetalle.html'
})
export class RecepcionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly habService = inject(HabitacionService);
  private readonly recService = inject(RecepcionService);
  private readonly personaService = inject(PersonaService);
  private readonly catService = inject(CategoriaService);
  private readonly pisoService = inject(PisoService);
  private readonly estService = inject(EstadoHabitacionService);

  habitacion = signal<HabitacionResponseDTO | null>(null);
  recepcion = signal<RecepcionResponseDTO>(this.inicializarModelo());
  listaPersonas = signal<Persona[]>([]);
  paginaActual = signal<number>(0);
  itemsPorPagina = 5;

  catMap = signal<Map<number, string>>(new Map());
  pisoMap = signal<Map<number, string>>(new Map());
  estMap = signal<Map<number, string>>(new Map());

  noches = signal<number>(1);
  dniBusqueda = signal('');
  guardando = signal(false);

  // Validación de estado Ocupado
  esOcupada = computed(() => {
    const hab = this.habitacion();
    if (!hab || !hab.estadoHabitacion) return false;
    const estId = typeof hab.estadoHabitacion === 'object' ? (hab.estadoHabitacion as any).idEstadoHabitacion : Number(hab.estadoHabitacion);
    const nombreEstado = (this.estMap().get(estId) || '').toLowerCase();
    return estId === 2 || nombreEstado.includes('ocupado');
  });

  // Validación de estado Mantenimiento
  esMantenimiento = computed(() => {
    const hab = this.habitacion();
    if (!hab || !hab.estadoHabitacion) return false;
    const estId = typeof hab.estadoHabitacion === 'object' ? (hab.estadoHabitacion as any).idEstadoHabitacion : Number(hab.estadoHabitacion);
    const nombreEstado = (this.estMap().get(estId) || '').toLowerCase();
    return estId === 3 || nombreEstado.includes('mantenimiento') || nombreEstado.includes('limpieza');
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

  // Computado para obtener los datos del cliente seleccionado o del ocupante actual
  cliente = computed(() => {
    const idCliente = this.recepcion().idCliente;
    if (!idCliente) return null;
    return this.listaPersonas().find(p => p.idPersona === idCliente) || null;
  });

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarClientes();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) this.cargarDatosHabitacion(id);
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
    const d = new Date();
    return this.formatearFecha(d);
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
    if (this.esOcupada() || this.esMantenimiento()) return; // Bloquear si está ocupada o mantenimiento
    const modalElement = document.getElementById('modalClientes');
    if (modalElement) {
      (window as any).bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
  }

  private cerrarModalClientes(): void {
    (document.activeElement as HTMLElement | null)?.blur();
    const modalElement = document.getElementById('modalClientes');
    if (modalElement) {
      (window as any).bootstrap?.Modal.getInstance(modalElement)?.hide();
    }
  }

  cargarDatosHabitacion(idHabitacion: number): void {
    this.habService.buscarPorId(idHabitacion).subscribe({
      next: res => {
        const hab = res.data;
        if (!hab) return;
        this.habitacion.set(hab);

        if (this.esMantenimiento()) {
          Swal.fire('Acceso Restringido', 'La habitación se encuentra en mantenimiento y no permite operaciones.', 'error')
            .then(() => this.router.navigate(['/admin/recepcion']));
          return;
        }

        // Si está ocupada, cargamos automáticamente los datos de la recepción activa para mostrárselos al administrador
        if (this.esOcupada()) {
          this.recService.buscarActivaPorHabitacion(idHabitacion).subscribe({
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
      error: err => {
        console.error('Error al cargar la habitación:', err);
        Swal.fire('Error', 'No se pudo cargar la información de la habitación', 'error');
      }
    });
  }

  private cargarCatalogos(): void {
    forkJoin({
      cats: this.catService.listar(),
      pisos: this.pisoService.listar(),
      estados: this.estService.listar()
    }).subscribe(({ cats, pisos, estados }) => {
      this.catMap.set(new Map((cats.data ?? []).map(c => [Number(c.idCategoria), c.descripcion])));
      this.pisoMap.set(new Map((pisos.data ?? []).map(p => [Number(p.idPiso), p.descripcion])));
      this.estMap.set(new Map((estados.data ?? []).map(e => [Number(e.idEstadoHabitacion), e.descripcion])));
    });
  }

  private cargarClientes(): void {
    this.personaService.listar().subscribe({
      next: (personas: Persona[]) => {
        const clientes = (personas ?? []).filter(
          (p: Persona) => Number(p.idTipoPersona) === ID_TIPO_PERSONA_CLIENTE && p.estado === true
        );
        this.listaPersonas.set(clientes);
      },
      error: err => {
        console.error('Error al cargar clientes:', err);
        Swal.fire('Error', 'No se pudieron cargar los clientes activos', 'error');
      }
    });
  }

  calcularTotal(): void {
    if (this.esOcupada()) return; // No calcular si es solo lectura

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
    this.recService.registrar(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        Swal.fire('Éxito', 'Check-in (Recepción) registrado correctamente', 'success');
        this.router.navigate(['/admin/recepcion']);
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire('Error', err.error?.message ?? 'Error al registrar la recepción', 'error');
      }
    });
  }

  seleccionarPersona(c: Persona): void {
    if (this.esOcupada()) return;
    this.recepcion.update(r => ({
      ...r,
      idCliente: c.idPersona!
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
    return this.catMap().get(Number(id)) ?? 'Cargando...';
  }

  getPisoNombre(id: number): string {
    return this.pisoMap().get(Number(id)) ?? 'Cargando...';
  }

  getHabitacionCategoriaId(): number {
    const hab = this.habitacion();
    if (!hab) return 0;
    return typeof hab.categoria === 'object' ? (hab.categoria as any)?.idCategoria : Number(hab.categoria || 0);
  }

  getHabitacionPisoId(): number {
    const hab = this.habitacion();
    if (!hab) return 0;
    return typeof hab.piso === 'object' ? (hab.piso as any)?.idPiso : Number(hab.piso || 0);
  }

  actualizarAdelanto(valor: unknown): void {
    if (this.esOcupada()) return;
    const adelanto = Number(valor) || 0;
    this.recepcion.update(r => ({ ...r, adelanto }));
    this.calcularTotal();
  }
}
