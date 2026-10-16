export interface DetalleVenta {
  idDetalleVenta?: number;
  idVenta?: number;
  idProducto: number;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subTotal: number;
}
