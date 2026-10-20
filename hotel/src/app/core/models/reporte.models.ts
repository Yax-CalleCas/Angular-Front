// --- 1. MODELOS DE INVENTARIO Y VENTAS ---

export interface ReporteVentaDto {
  idProducto: number;
  nombreProducto: string;
  cantidadVendida: number;
  ingresoGenerado: number;
}

export interface ProductoDto {
  idProducto: number;
  nombre: string;
  detalle: string;
  precio: number;
  cantidad: number;
  estado: boolean;
  imagenUrl?: string;
  fechaCreacion?: string;
}

// --- 2. MODELOS DE RECEPCIÓN Y ALQUILERES ---

export interface RecepcionResponseDTO {
  idRecepcion: number;
  idHabitacion: number;
  numeroHabitacion?: string;       // Opcional según tu backend
  nombreCliente?: string;          // Opcional según tu backend
  fechaIngreso: string;
  fechaSalida: string;
  estado: boolean;
  costoTotal?: number;
  costoPenalidad?: number;
  observacion?: string;
}

// --- 3. MODELOS DE PENALIDADES ---

export interface ResumenPenalidadesDto {
  totalPenalidadesAplicadas: number;
  montoTotalRecaudadoPenalidades: number;
  detallePenalidades?: any[];
}

// --- 4. WRAPPER GENERAL DE RESPUESTA (ApiResponse del Backend) ---

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  status?: number;
  data: T;
}
