

import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../../core/services/habitacion.service';
import {
  RecepcionService,
  RegistrarRecepcionRequest,
  SalidaRequest
} from '../../../core/services/recepcion.service';
import { PersonaService } from '../../../core/services/persona.service';
import { CategoriaService } from '../../../core/services/categoria.service';
import { PisoService } from '../../../core/services/piso.service';
import { EstadoHabitacionService } from '../../../core/services/EstadoHabitacionService';
import { HabitacionResponseDTO, HabitacionRequestDTO } from '../../../core/models/Habitacion';
import { Persona } from '../../../core/models/persona.model';
import { Recepcion } from '../../../core/models/recepcion.model';

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
  recepcion = signal<Recepcion>(this.inicializarModelo());
  listaPersonas = signal<Persona[]>([]);
  paginaActual = signal<number>(0);
  itemsPorPagina = 5;

  catMap = signal<Map<number, string>>(new Map());
  pisoMap = signal<Map<number, string>>(new Map());
  estMap = signal<Map<number, string>>(new Map());

  noches = signal<number>(1);
  dniBusqueda = signal('');
  guardando = signal(false);

  // Validación robusta corregida y limpia
  esOcupada = computed(() => {
    const hab = this.habitacion();
    if (!hab || !hab.estadoHabitacion) return false;
    const nombreEstado = (this.estMap().get(Number(hab.estadoHabitacion)) || hab.detalle || '').toLowerCase();
    return nombreEstado.includes('ocupado');
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

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarClientes();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) this.cargarDatos(id);
    });
  }

  private inicializarModelo(): Recepcion {
    const hoy = this.hoyLocal();
    return {
      idCliente: 0,
      idHabitacion: 0,
      fechaEntrada: hoy,
      fechaSalida: hoy,
      precioInicial: 0,
      adelanto: 0,
      precioRestante: 0,
      totalPagado: 0,
      costoPenalidad: 0,
      estado: true
    };
  }

  private hoyLocal(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  private soloFecha(valor: unknown): string {
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

  cargarDatos(idHabitacion: number): void {
    this.habService.buscarPorId(idHabitacion).subscribe({
      next: res => {
        const hab = res.data;
        if (!hab) return;
        this.habitacion.set(hab);

        if (this.esOcupada()) {
          this.obtenerHospedajeActivo(idHabitacion);
        } else {
          this.recepcion.update(r => ({ ...r, idHabitacion, precioInicial: hab.precio }));
          this.calcularTotal();
        }
      },
      error: err => {
        console.error('Error al cargar la habitación:', err);
        Swal.fire('Error', 'No se pudo cargar la habitación', 'error');
      }
    });
  }

  private obtenerHospedajeActivo(idHabitacion: number): void {
    this.recService.buscarActivaPorHabitacion(idHabitacion).subscribe({
      next: res => {
        if (res.data) {
          this.recepcion.set(res.data);
          this.noches.set(this.calcularNoches());
        }
      },
      error: err => {
        console.error('Error al obtener hospedaje activo:', err);
        Swal.fire(
          'Atención',
          err.error?.message ?? 'La habitación figura ocupada pero no tiene una recepción activa',
          'warning'
        );
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
    const hab = this.habitacion();
    if (!hab) return;

    const noches = this.calcularNoches();
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
    if (this.guardando()) return;

    const r = this.recepcion();

    if (r.idCliente == null || r.idCliente === 0) {
      Swal.fire('Error', 'Seleccione un cliente primero', 'error');
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
    const precio = Number(r.precioInicial) || 0;
    const adelanto = Number(r.adelanto) || 0;
    if (adelanto < 0 || adelanto > precio) {
      Swal.fire('Error', 'El adelanto no puede ser negativo ni mayor al total', 'error');
      return;
    }

    const payload: RegistrarRecepcionRequest = {
      idCliente: r.idCliente,
      idHabitacion: r.idHabitacion,
      fechaSalida: this.soloFecha(r.fechaSalida),
      precioInicial: precio,
      adelanto,
      observacion: r.observacion?.trim() || null
    };

    this.guardando.set(true);
    this.recService.registrar(payload).subscribe({
      next: () => {
        this.guardando.set(false);
        Swal.fire('Éxito', 'Reservación registrada correctamente', 'success');
        this.router.navigate(['/admin/recepcion']);
      },
      error: err => {
        this.guardando.set(false);
        Swal.fire('Error', err.error?.message ?? 'Error al guardar', 'error');
      }
    });
  }

  registrarSalida(): void {
    const r = this.recepcion();
    if (r.idRecepcion == null || r.idHabitacion == null) return;

    Swal.fire({
      title: '¿Registrar la salida?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar'
    }).then(resultado => {
      if (!resultado.isConfirmed) return;

      const payload: SalidaRequest = {
        idRecepcion: r.idRecepcion!,
        idHabitacion: r.idHabitacion!,
        costoPenalidad: Number(r.costoPenalidad) || 0,
        totalPagado: Number(r.totalPagado) || 0
      };

      this.recService.registrarSalida(payload).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Salida registrada correctamente', 'success');
          this.router.navigate(['/admin/recepcion']);
        },
        error: err => Swal.fire('Error', err.error?.message ?? 'Error al registrar la salida', 'error')
      });
    });
  }

  seleccionarPersona(c: Persona): void {
    this.recepcion.update(r => ({
      ...r,
      idCliente: c.idPersona!
    }));
    this.cerrarModalClientes();
  }

  buscarCliente(): void {
    const busqueda = this.dniBusqueda().trim();
    const cliente = this.listaPersonas().find(p => p.documento?.toString().trim() === busqueda);

    if (cliente) {
      this.seleccionarPersona(cliente);
    } else {
      Swal.fire('Atención', 'Cliente no encontrado en la lista de clientes', 'warning');
    }
  }

  getCatNombre(id: number): string {
    return this.catMap().get(Number(id)) ?? 'Cargando...';
  }

  getPisoNombre(id: number): string {
    return this.pisoMap().get(Number(id)) ?? 'Cargando...';
  }
}
