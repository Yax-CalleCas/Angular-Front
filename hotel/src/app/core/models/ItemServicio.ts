export interface ItemServicio {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  estadoVenta: 'PAGADO' | 'PENDIENTE' | 'DEBE';
  subTotal: number;
}
