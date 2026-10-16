
export interface ReporteProductoDto {
  idProducto: number;
  nombreProducto: string;
  cantidad: number;
  precio: number;
  estado: boolean;
}

export interface ReporteVentaDto {
  nombreProducto: string;
  cantidadTotal: number;
  totalIngresado: number;
}

export interface ReporteHabitacionDto {
  numeroHabitacion: string;
  descripcionCategoria: string;
  vecesAlquilada: number;
}

export interface ReporteCobroDto {
  numeroHabitacion: string;
  nombreCliente: string;
  totalAlojamiento: number;
  totalConsumos: number;
  totalGeneral: number;
  fechaCierre: string;
}
