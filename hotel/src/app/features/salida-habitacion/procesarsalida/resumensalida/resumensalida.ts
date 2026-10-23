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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import { RecepcionService } from '../../../../core/services/recepcion.service';
import { VentaService } from '../../../../core/services/venta.service';
import { PersonaService } from '../../../../core/services/persona.service';
import { HabitacionService } from '../../../../core/services/habitacion.service';
import { Venta } from '../../../../core/models/Venta';
import { RecepcionResponseDTO } from '../../../../core/models/recepcion.model';

type EstadoPantalla = 'cargando' | 'listo' | 'error';
type EstadoVenta = 'PAGADO' | 'PENDIENTE' | 'DEBE';
type EstadoVentaVista = EstadoVenta | 'OTRO';

export interface LineaConsumo {
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

/** Montos del comprobante. Todos provienen del servidor, salvo las sumas de consumos. */
export interface ResumenLiquidacion {
  alojamiento: number;
  penalidad: number;
  subtotalEstancia: number;
  adelanto: number;
  saldoEstancia: number;
  saldoAFavorCliente: number;
  totalConsumos: number;
  consumosPendientes: number;
  totalAPagar: number;
}

interface DatosPantalla {
  recepcion: RecepcionResponseDTO;
  ventas: Venta[];
  cliente: ClienteResumen | null;
  numeroHabitacion: string | null;
}

class RecepcionNoEncontradaError extends Error {
  constructor() {
    super('No se encontró información para esta recepción.');
  }
}

const ESTADOS_VENTA: readonly EstadoVenta[] = ['PAGADO', 'PENDIENTE', 'DEBE'];
const ESTADOS_CON_DEUDA: readonly EstadoVentaVista[] = ['PENDIENTE', 'DEBE'];
const LONGITUD_MAX_MENSAJE = 300;

function numeroSeguro(valor: number | null | undefined): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Suma en centimos enteros para evitar errores de coma flotante. */
function sumar(valores: readonly number[]): number {
  return valores.reduce((total, v) => total + Math.round(v * 100), 0) / 100;
}

function normalizarEstadoVenta(valor: string | null | undefined): EstadoVentaVista {
  const estado = (valor ?? '').trim().toUpperCase();
  return (ESTADOS_VENTA as readonly string[]).includes(estado) ? (estado as EstadoVenta) : 'OTRO';
}

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

/** Los errores 5xx nunca exponen el detalle del servidor; los 4xx muestran su mensaje de negocio. */
function mensajeDeError(err: unknown, mensajePorDefecto: string): string {
  if (err instanceof RecepcionNoEncontradaError) {
    return err.message;
  }
  if (!(err instanceof HttpErrorResponse)) {
    return mensajePorDefecto;
  }
  if (err.status === 0) {
    return 'No se pudo contactar con el servidor. Verifique su conexión e intente nuevamente.';
  }
  if (err.status === 401 || err.status === 403) {
    return 'Su sesión expiró o no tiene permisos para ver este comprobante.';
  }
  if (err.status >= 500) {
    return mensajePorDefecto;
  }
  return extraerMensajeServidor(err.error) ?? mensajePorDefecto;
}

@Component({
  selector: 'app-resumensalida',
  standalone: true,
  imports: [RouterLink, NgClass, DatePipe, DecimalPipe],
  templateUrl: './resumensalida.html',
  styleUrls: ['./resumensalida.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Resumensalida implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recepcionService = inject(RecepcionService);
  private readonly ventaService = inject(VentaService);
  private readonly personaService = inject(PersonaService);
  private readonly habitacionService = inject(HabitacionService);

  readonly fechaEmision = new Date();

  // Estado de la pantalla
  readonly estado = signal<EstadoPantalla>('cargando');
  readonly mensajeError = signal<string | null>(null);
  readonly idRecepcion = signal<number | null>(null);

  // Datos
  readonly datos = signal<RecepcionResponseDTO | null>(null);
  readonly consumos = signal<readonly LineaConsumo[]>([]);
  readonly clienteCargado = signal<ClienteResumen | null>(null);
  readonly numeroHabitacionCargado = signal<string | null>(null);

  /** La recepcion esta cerrada: los montos del servidor ya son los definitivos. */
  readonly esDefinitivo = computed(() => this.datos()?.estado === false);

  readonly cliente = computed<ClienteResumen | null>(() => {
    const cargado = this.clienteCargado();
    if (cargado) {
      return cargado;
    }
    const d = this.datos();
    const nombre = `${d?.nombreCliente ?? ''} ${d?.apellidoCliente ?? ''}`.trim();
    if (!d || nombre === '') {
      return null;
    }
    return {
      nombreCompleto: nombre,
      documento: d.documentoCliente ?? d.documento ?? null,
      correo: d.correoCliente ?? d.correo ?? null
    };
  });

  readonly habitacion = computed(() => {
    const d = this.datos();
    if (!d) {
      return '';
    }
    return this.numeroHabitacionCargado() ?? d.numeroHabitacion ?? `ID ${d.idHabitacion}`;
  });

  /** Fecha real de salida registrada por el servidor; null mientras la estancia siga activa. */
  readonly fechaSalidaConfirmada = computed<Date | null>(() => {
    const valor = this.datos()?.fechaSalidaConfirmacion;
    if (!valor) {
      return null;
    }
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  });

  readonly consumosConEstadoDesconocido = computed(
    () => this.consumos().filter(c => c.estadoVenta === 'OTRO').length
  );

  readonly liquidacion = computed<ResumenLiquidacion | null>(() => {
    const d = this.datos();
    if (!d) {
      return null;
    }

    // Tras el check-out el backend deja en precioInicial el alojamiento ya facturado
    // y en precioRestante el saldo de estancia (alojamiento + penalidad - pagado).
    const alojamiento = numeroSeguro(d.precioInicial);
    const penalidad = numeroSeguro(d.costoPenalidad);
    const adelanto = numeroSeguro(d.adelanto);
    const saldoEstancia = numeroSeguro(d.precioRestante);
    const subtotalEstancia = sumar([alojamiento, penalidad]);

    const lineas = this.consumos();
    const totalConsumos = sumar(lineas.map(c => c.subTotal));
    const consumosPendientes = sumar(
      lineas.filter(c => ESTADOS_CON_DEUDA.includes(c.estadoVenta)).map(c => c.subTotal)
    );

    return {
      alojamiento,
      penalidad,
      subtotalEstancia,
      adelanto,
      saldoEstancia,
      saldoAFavorCliente: redondear2(Math.max(adelanto - subtotalEstancia, 0)),
      totalConsumos,
      consumosPendientes,
      totalAPagar: sumar([saldoEstancia, consumosPendientes])
    };
  });

  ngOnInit(): void {
    const crudo = this.route.snapshot.paramMap.get('id');
    const id = crudo !== null ? Number(crudo) : Number.NaN;

    if (!Number.isInteger(id) || id <= 0) {
      this.mensajeError.set('El identificador de la recepción no es válido.');
      this.estado.set('error');
      return;
    }

    this.idRecepcion.set(id);
    this.cargarDatos(id);
  }

  reintentar(): void {
    const id = this.idRecepcion();
    if (id !== null) {
      this.cargarDatos(id);
    }
  }

  imprimir(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  // ---------------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------------

  private cargarDatos(idRecepcion: number): void {
    this.estado.set('cargando');
    this.mensajeError.set(null);

    this.recepcionService
      .buscarPorId(idRecepcion)
      .pipe(
        switchMap(respuesta => {
          const recepcion = respuesta.data;
          if (!recepcion) {
            return throwError(() => new RecepcionNoEncontradaError());
          }
          return forkJoin({
            // Critico: sin los consumos el comprobante saldria con un total incorrecto.
            ventas: this.ventaService
              .buscarPorRecepcion(recepcion.idRecepcion)
              .pipe(map(r => r.data ?? [])),
            // No criticos: si fallan, se usan los datos que traiga la recepcion.
            cliente: this.cargarCliente(recepcion.idCliente),
            numeroHabitacion: this.cargarNumeroHabitacion(recepcion.idHabitacion)
          }).pipe(map((extra): DatosPantalla => ({ recepcion, ...extra })));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: datos => this.aplicarDatos(datos),
        error: (err: unknown) => {
          this.mensajeError.set(mensajeDeError(err, 'No se pudo obtener el detalle de la recepción para el comprobante.'));
          this.estado.set('error');
        }
      });
  }

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

  /** El backend de recepcion no devuelve el numero de habitacion; se consulta aparte. */
  private cargarNumeroHabitacion(idHabitacion: number): Observable<string | null> {
    return this.habitacionService.buscarPorId(idHabitacion).pipe(
      map(respuesta => {
        const numero = respuesta.data?.numero;
        return numero !== undefined && numero !== null ? String(numero) : null;
      }),
      catchError(() => of(null))
    );
  }

  private aplicarDatos({ recepcion, ventas, cliente, numeroHabitacion }: DatosPantalla): void {
    this.datos.set(recepcion);
    this.clienteCargado.set(cliente);
    this.numeroHabitacionCargado.set(numeroHabitacion);
    this.consumos.set(this.mapearConsumos(ventas));
    this.estado.set('listo');
  }

  private mapearConsumos(ventas: Venta[]): LineaConsumo[] {
    return ventas.flatMap((venta, i) => {
      const estadoVenta = normalizarEstadoVenta(venta.estado);

      return (venta.detalleVentas ?? []).map((detalle, j): LineaConsumo => {
        const cantidad = numeroSeguro(detalle.cantidad);
        const precioUnitario = numeroSeguro(detalle.precioUnitario);
        const subTotal =
          detalle.subTotal !== undefined && detalle.subTotal !== null
            ? numeroSeguro(detalle.subTotal)
            : redondear2(cantidad * precioUnitario);

        return {
          id: `${venta.idVenta ?? `v${i}`}-${detalle.idDetalleVenta ?? `d${j}`}`,
          producto: detalle.nombreProducto?.trim() || 'Producto de inventario',
          cantidad,
          precioUnitario,
          subTotal,
          estadoVenta
        };
      });
    });
  }
}
