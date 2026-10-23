// Espejo de los DTOs del backend (Jackson serializa LocalDate/LocalDateTime como string ISO
// y BigDecimal como number)

export interface Producto {
  idProducto: number;
  nombre: string;
  detalle: string;
  precio: number;
  cantidad: number;
  estado: boolean;
  imagenUrl: string | null;
  fechaCreacion: string;
}

export interface ReporteProductoPopular {
  idProducto: number;
  nombreProducto: string;
  cantidadVendida: number;
  ingresoGenerado: number;
  fechaCorte: string;
}

export interface DashboardEstadisticas {
  generadoEn: string;

  // Ventas / inventario
  ventasHoy: number;
  ingresoVentasHoy: number;
  cantidadStockBajo: number;
  topProductos: ReporteProductoPopular[];
  productosStockBajo: Producto[];

  // Recepción / hospedaje
  estanciasActivas: number;
  checkInsHoy: number;
  salidasPrevistasHoy: number;
  salidasHoy: number;
  cuentasPorCobrarCantidad: number;
  montoPorCobrar: number;
  ingresoHospedajeHoy: number;
  penalidadesHoyCantidad: number;
  penalidadesHoyMonto: number;

  // Total
  ingresoTotalHoy: number;
}
