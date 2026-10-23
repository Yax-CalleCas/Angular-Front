/**
 * Utilidades puras para estimar la liquidacion de una salida (check-out).
 *
 * Replican la regla de RecepcionServiceImpl.registrarCheckOut del backend:
 *  - noches facturadas = noches transcurridas desde la entrada, con minimo 1 y
 *    maximo igual a las noches reservadas;
 *  - alojamiento = precio inicial proporcional a las noches facturadas;
 *  - saldo de estancia = max(alojamiento + penalidad - total pagado, 0).
 *
 * Es una ESTIMACION para mostrar al operador. El monto definitivo siempre lo
 * calcula el servidor (la fecha de salida se toma de su reloj).
 * Todo el calculo se hace en centimos enteros para evitar errores de coma flotante.
 */

const MS_POR_DIA = 86400000;

export interface DatosLiquidacion {
  fechaEntrada: string;
  fechaSalidaProgramada: string;
  precioInicial: number;
  totalPagado: number;
  penalidad: number;
  consumosPendientes: number;
}

export interface ResultadoLiquidacion {
  nochesReservadas: number;
  nochesFacturadas: number;
  alojamiento: number;
  penalidad: number;
  totalPagado: number;
  saldoEstancia: number;
  consumosPendientes: number;
  totalACobrar: number;
}

/** Convierte a numero finito; cualquier valor invalido pasa a 0. */
export function numeroSeguro(valor: number | null | undefined): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/** Redondea a 2 decimales. */
export function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function aCentimos(valor: number): number {
  return Math.round(valor * 100);
}

function deCentimos(centimos: number): number {
  return centimos / 100;
}

/** Interpreta 'YYYY-MM-DD' como fecha civil (UTC) para evitar desfases de zona horaria. */
function fechaIsoAUtc(valor: string | null | undefined): number | null {
  if (!valor) {
    return null;
  }
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!coincidencia) {
    return null;
  }
  return Date.UTC(
    Number(coincidencia[1]),
    Number(coincidencia[2]) - 1,
    Number(coincidencia[3])
  );
}

/**
 * Devuelve null cuando los datos de la estancia no permiten calcular
 * (fechas invalidas o precio no positivo); el backend los rechazaria igualmente.
 */
export function calcularLiquidacion(
  datos: DatosLiquidacion,
  hoy: Date = new Date()
): ResultadoLiquidacion | null {
  const entrada = fechaIsoAUtc(datos.fechaEntrada);
  const salida = fechaIsoAUtc(datos.fechaSalidaProgramada);
  if (entrada === null || salida === null || salida <= entrada) {
    return null;
  }

  const precioCentimos = aCentimos(numeroSeguro(datos.precioInicial));
  if (precioCentimos <= 0) {
    return null;
  }

  const nochesReservadas = Math.round((salida - entrada) / MS_POR_DIA);
  const hoyUtc = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const nochesTranscurridas = Math.round((hoyUtc - entrada) / MS_POR_DIA);
  const nochesFacturadas = Math.min(Math.max(1, nochesTranscurridas), nochesReservadas);

  const alojamientoCentimos =
    nochesFacturadas === nochesReservadas
      ? precioCentimos
      : Math.round((precioCentimos * nochesFacturadas) / nochesReservadas);

  const penalidadCentimos = Math.max(0, aCentimos(numeroSeguro(datos.penalidad)));
  const pagadoCentimos = Math.max(0, aCentimos(numeroSeguro(datos.totalPagado)));
  const consumosCentimos = Math.max(0, aCentimos(numeroSeguro(datos.consumosPendientes)));

  const saldoCentimos = Math.max(
    alojamientoCentimos + penalidadCentimos - pagadoCentimos,
    0
  );

  return {
    nochesReservadas,
    nochesFacturadas,
    alojamiento: deCentimos(alojamientoCentimos),
    penalidad: deCentimos(penalidadCentimos),
    totalPagado: deCentimos(pagadoCentimos),
    saldoEstancia: deCentimos(saldoCentimos),
    consumosPendientes: deCentimos(consumosCentimos),
    totalACobrar: deCentimos(saldoCentimos + consumosCentimos)
  };
}
