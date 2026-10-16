export interface Habitacion {
  idHabitacion?: number;
  numero: string;
  detalle?: string;
  precio: number;
  estado?: boolean;
  version?: number;
  idHotel?: number;
  descripcionEstado?: string; // 🔹 Propiedad añadida para la validación de estados

  // Claves foráneas
  idPiso?: number;
  idCategoria?: number;
  idEstadoHabitacion?: number;

  // Descripciones para vistas administrativas
  categoriaDesc?: string;
  pisoDesc?: string;
  estadoFisico?: string;

  // Propiedades para las vistas del cliente
  categoriaNombre?: string;
  estadoDescripcion?: string;
  estadoHabitacionDesc?: string;

  urlsImagenes?: string[];
}
