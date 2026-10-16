export interface Carrito {
  idCarrito?: number;
  idRecepcion: number;
  idPersona: number;
  idProducto: number;

  // Información del producto
  nombreProducto?: string;
  precioUnitario?: number;
  imagenUrl?: string;

  cantidad: number;
  fechaRegistro?: string;

  // El cálculo del subtotal en el frontend
  subtotal?: number;
}
