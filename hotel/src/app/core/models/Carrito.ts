export interface Carrito {
  idCarrito?: number;
  idRecepcion: number;
  idProducto: number;

  // Información adicional que retorna el backend o se calcula
  nombreProducto?: string;
  precioProducto?: number;
  imagenUrl?: string;

  cantidad: number;
  subtotal?: number;
  fechaRegistro?: string;
}
