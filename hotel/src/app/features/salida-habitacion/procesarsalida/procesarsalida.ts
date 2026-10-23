import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { RecepcionService } from '../../../core/services/recepcion.service';
import { VentaService } from '../../../core/services/venta.service';
import { PersonaService } from '../../../core/services/persona.service';
import { Venta } from '../../../core/models/Venta';
import { RecepcionResponseDTO, SalidaRequest } from '../../../core/models/recepcion.model';
import {
  ResultadoLiquidacion,
  calcularLiquidacion,
  numeroSeguro,
  redondear2
} from '../../../core/utils/liquidacion-salida.util';

type EstadoPantalla = 'cargando' | 'listo' | 'error';
type EstadoVenta = 'PAGADO' | 'PENDIENTE' | 'DEBE';
type EstadoVentaVista = EstadoVenta | 'OTRO';

export interface ItemServicio {
  id: string;
  producto: string;
  cantidad: number;
  precioUnitario: number;
  subTotal: number;
  estadoVenta: EstadoVentaVista;
}

/** Vista minima del cliente: no se conserva el resto de campos de Persona. */
export interface ClienteResumen {
  nombreCompleto: string;
  documento: string | null;
  correo: string | null;
}

interface DatosPantalla {
  recepcion: RecepcionResponseDTO;
  ventas: Venta[];
  cliente: ClienteResumen | null;
}

interface ErrorVista {
  titulo: string;
  mensaje: string;
  icono: SweetAlertIcon;
}

class RecepcionNoEncontradaError extends Error {
  constructor() {
    super('No se encontró una recepción activa para esta habitación.');
  }
}

const ESTADOS_VENTA: readonly EstadoVenta[] = ['PAGADO', 'PENDIENTE', 'DEBE'];
const ESTADOS_CON_DEUDA: readonly EstadoVentaVista[] = ['PENDIENTE', 'DEBE'];
const LONGITUD_MAX_MENSAJE = 300;

function normalizarEstadoVenta(valor: string | null | undefined): EstadoVentaVista {
  const estado = (valor ?? '').trim().toUpperCase();
  return (ESTADOS_VENTA as readonly string[]).includes(estado) ? (estado as EstadoVenta) : 'OTRO';
}

/** Devuelve el mensaje de negocio del servidor solo si es texto plano y acotado. */
function extraerMensajeServidor(cuerpo: unknown): string | null {
  let texto: string | null = null;

  if (typeof cuerpo === 'string') {
    texto = cuerpo;
  } else if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
    const mensaje = (cuerpo as { message?: unknown }).message;
    texto = typeof mensaje === 'string' ? mensaje : null;
  }

  const limpio = texto?.trim() ?? '';
  if (limpio === '' || limpio.startsWith('<')) {
    return null;
  }
  return limpio.slice(0, LONGITUD_MAX_MENSAJE);
}

/**
 * Traduce un error a un mensaje para el operador. Los errores 5xx nunca exponen
 * el detalle del servidor; los 4xx muestran el mensaje de negocio si existe.
 */
function describirError(err: unknown, mensajePorDefecto: string): ErrorVista {
  if (err instanceof RecepcionNoEncontradaError) {
    return { titulo: 'No encontrado', mensaje: err.message, icono: 'error' };
  }
  if (!(err instanceof HttpErrorResponse)) {
    return { titulo: 'Error', mensaje: mensajePorDefecto, icono: 'error' };
  }
  if (err.status === 0) {
    return {
      titulo: 'Sin conexión',
      mensaje: 'No se pudo contactar con el servidor. Verifique su conexión e intente nuevamente.',
      icono: 'error'
    };
  }
  if (err.status === 401 || err.status === 403) {
    return {
      titulo: 'Acceso denegado',
      mensaje: 'Su sesión expiró o no tiene permisos para realizar esta operación.',
      icono: 'error'
    };
  }
  if (err.status >= 500) {
    return { titulo: 'Error del servidor', mensaje: mensajePorDefecto, icono: 'error' };
  }

  const detalle = extraerMensajeServidor(err.error);

  switch (err.status) {
    case 404:
      return { titulo: 'No encontrado', mensaje: detalle ?? 'No se encontró el recurso solicitado.', icono: 'error' };
    case 409:
      return {
        titulo: 'Operación no permitida',
        mensaje: detalle ?? 'La habitación tiene una operación activa. Intente nuevamente en unos minutos.',
        icono: 'warning'
      };
    case 412:
      return {
        titulo: 'Conflicto de versión',
        mensaje: 'La información cambió en el servidor. Por favor recargue la pagina.',
        icono: 'error'
      };
    default:
      return { titulo: 'Error', mensaje: detalle ?? mensajePorDefecto, icono: 'error' };
  }
}

@Component({
  selector: 'app-procesarsalida',
  standalone: true,
  imports: [RouterLink, NgClass, DecimalPipe, DatePipe],
  templateUrl: './procesarsalida.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Procesarsalida implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recepcionService = inject(RecepcionService);
  private readonly ventaService = inject(VentaService);
  private readonly personaService = inject(PersonaService);

  // Estado de la pantalla
  readonly estado = signal<EstadoPantalla>('cargando');
  readonly mensajeError = signal<string | null>(null);
  readonly procesando = signal(false);
  readonly idHabitacion = signal<number | null>(null);

  // Datos
  readonly datosHospedaje = signal<RecepcionResponseDTO | null>(null);
  readonly clienteCargado = signal<ClienteResumen | null>(null);
  readonly servicios = signal<readonly ItemServicio[]>([]);

  // Entradas del operador
  readonly costoPenalidad = signal(0);
  readonly observacion = signal('');

  /** Cliente cargado desde auth-service o, en su defecto, los datos que traiga la recepcion. */
  readonly cliente = computed<ClienteResumen | null>(() => {
    const cargado = this.clienteCargado();
    if (cargado) {
      return cargado;
    }
    const h = this.datosHospedaje();
    const nombre = `${h?.nombreCliente ?? ''} ${h?.apellidoCliente ?? ''}`.trim();
    if (!h || nombre === '') {
      return null;
    }
    return {
      nombreCompleto: nombre,
      documento: h.documentoCliente ?? h.documento ?? null,
      correo: h.correoCliente ?? h.correo ?? null
    };
  });

  readonly totalConsumosPendientes = computed(() => {
    const centimos = this.servicios()
      .filter(s => ESTADOS_CON_DEUDA.includes(s.estadoVenta))
      .reduce((suma, s) => suma + Math.round(s.subTotal * 100), 0);
    return centimos / 100;
  });

  readonly consumosConEstadoDesconocido = computed(() =>
    this.servicios().filter(s => s.estadoVenta === 'OTRO').length
  );

  readonly liquidacion = computed<ResultadoLiquidacion | null>(() => {
    const h = this.datosHospedaje();
    if (!h) {
      return null;
    }
    return calcularLiquidacion({
      fechaEntrada: h.fechaEntrada,
      fechaSalidaProgramada: h.fechaSalida,
      precioInicial: h.precioInicial,
      totalPagado: h.totalPagado,
      penalidad: this.costoPenalidad(),
      consumosPendientes: this.totalConsumosPendientes()
    });
  });

  readonly puedeProcesar = computed(
    () => this.estado() === 'listo' && !this.procesando() && this.liquidacion() !== null
  );

  ngOnInit(): void {
    const crudo = this.route.snapshot.paramMap.get('id');
    const id = crudo !== null ? Number(crudo) : Number.NaN;

    if (!Number.isInteger(id) || id <= 0) {
      this.mensajeError.set('El identificador de la habitación no es válido.');
      this.estado.set('error');
      return;
    }

    this.idHabitacion.set(id);
    this.cargarDatos(id);
  }

  reintentar(): void {
    const id = this.idHabitacion();
    if (id !== null) {
      this.cargarDatos(id);
    }
  }

  onPenalidadInput(evento: Event): void {
    const numero = Number(this.valorDe(evento));
    this.costoPenalidad.set(Number.isFinite(numero) && numero > 0 ? redondear2(numero) : 0);
  }

  onObservacionInput(evento: Event): void {
    this.observacion.set(this.valorDe(evento));
  }

  async finalizarCheckOut(): Promise<void> {
    const h = this.datosHospedaje();
    const liq = this.liquidacion();
    if (!h || !liq || this.procesando()) {
      return;
    }

    const confirmacion = await Swal.fire({
      title: 'Confirmar salida (check-out)',
      text:
        `Alojamiento estimado: S/ ${liq.alojamiento.toFixed(2)} (${liq.nochesFacturadas} de ` +
        `${liq.nochesReservadas} noches) más penalidad S/ ${liq.penalidad.toFixed(2)}. ` +
        `Saldo de estancia estimado: S/ ${liq.saldoEstancia.toFixed(2)}. ` +
        `Esta operación no cambia el estado de pago de los consumos. ` +
        `El servidor calcula el monto definitivo y la habitación pasará a limpieza.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar check-out',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) {
      return;
    }

    const observacion = this.observacion().trim();
    const payload: SalidaRequest = {
      idRecepcion: h.idRecepcion,
      costoPenalidad: liq.penalidad,
      ...(observacion !== '' ? { observacion } : {})
    };

    this.procesando.set(true);
    this.recepcionService
      .registrarSalida(h.idRecepcion, payload)
      .pipe(
        finalize(() => this.procesando.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => void this.notificarExitoYNavegar(h.idRecepcion),
        error: (err: unknown) => this.notificarError(err, 'No se pudo procesar la salida.')
      });
  }

  // ---------------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------------

  private cargarDatos(idHabitacion: number): void {
    this.estado.set('cargando');
    this.mensajeError.set(null);

    this.recepcionService
      .buscarActivaPorHabitacion(idHabitacion)
      .pipe(
        switchMap(respuesta => {
          const recepcion = respuesta.data;
          if (!recepcion) {
            return throwError(() => new RecepcionNoEncontradaError());
          }
          return forkJoin({
            ventas: this.ventaService
              .buscarPorRecepcion(recepcion.idRecepcion)
              .pipe(map(r => r.data ?? [])),
            cliente: this.cargarCliente(recepcion.idCliente)
          }).pipe(map((extra): DatosPantalla => ({ recepcion, ...extra })));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: datos => this.aplicarDatos(datos),
        error: (err: unknown) => {
          this.mensajeError.set(describirError(err, 'No se pudieron cargar los datos de la salida.').mensaje);
          this.estado.set('error');
        }
      });
  }

  /** Consulta solo al cliente de la recepcion; un fallo aqui no bloquea la pantalla. */
  private cargarCliente(idCliente: number): Observable<ClienteResumen | null> {
    return this.personaService.obtenerPorId(idCliente).pipe(
      map(
        (persona): ClienteResumen => ({
          nombreCompleto: `${persona.nombre} ${persona.apellido}`.trim(),
          documento: persona.documento || null,
          correo: persona.correo || null
        })
      ),
      catchError(() => of(null))
    );
  }

  private aplicarDatos({ recepcion, ventas, cliente }: DatosPantalla): void {
    this.datosHospedaje.set(recepcion);
    this.clienteCargado.set(cliente);
    this.servicios.set(this.mapearServicios(ventas));
    this.costoPenalidad.set(numeroSeguro(recepcion.costoPenalidad) > 0 ? numeroSeguro(recepcion.costoPenalidad) : 0);
    this.estado.set('listo');
  }

  private mapearServicios(ventas: Venta[]): ItemServicio[] {
    return ventas.flatMap((venta, i) => {
      const estadoVenta = normalizarEstadoVenta(venta.estado);

      return (venta.detalleVentas ?? []).map((detalle, j): ItemServicio => {
        const cantidad = numeroSeguro(detalle.cantidad);
        const precioUnitario = numeroSeguro(detalle.precioUnitario);
        const subTotal =
          detalle.subTotal !== undefined && detalle.subTotal !== null
            ? numeroSeguro(detalle.subTotal)
            : redondear2(cantidad * precioUnitario);

        return {
          id: `${venta.idVenta ?? `v${i}`}-${detalle.idDetalleVenta ?? `d${j}`}`,
          producto: detalle.nombreProducto?.trim() || 'Producto sin nombre',
          cantidad,
          precioUnitario,
          subTotal,
          estadoVenta
        };
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Utilidades de interfaz
  // ---------------------------------------------------------------------------

  private valorDe(evento: Event): string {
    const destino = evento.target;
    return destino instanceof HTMLInputElement || destino instanceof HTMLTextAreaElement
      ? destino.value
      : '';
  }

  private async notificarExitoYNavegar(idRecepcion: number): Promise<void> {
    await Swal.fire('Salida registrada', 'La estancia fue cerrada y la habitación fue enviada a limpieza.', 'success');
    await this.router.navigate(['/admin/resumensalida', idRecepcion]);
  }

  private notificarError(err: unknown, mensajePorDefecto: string): void {
    const { titulo, mensaje, icono } = describirError(err, mensajePorDefecto);
    void Swal.fire(titulo, mensaje, icono);
  }
}
