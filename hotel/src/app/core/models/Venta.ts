
import { DetalleVenta } from "./detalleventa";

export interface Venta {
  idVenta?: number;
  idRecepcion: number;
  total?: number;
  estado: string;
  detalles: DetalleVenta[];
}

export interface ItemServicio {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  estadoVenta: 'PAGADO' | 'PENDIENTE' | 'DEBE';
  subTotal: number;
}
