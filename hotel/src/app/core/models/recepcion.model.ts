export interface Recepcion {
  idRecepcion?: number;
  idCliente: number;
  idHabitacion: number;
  fechaEntrada: string;
  fechaSalida: string;
  fechaSalidaConfirmacion?: string | null;
  precioInicial: number;
  adelanto?: number;
  precioRestante?: number;
  totalPagado?: number;
  costoPenalidad?: number;
  observacion?: string | null;
  estado: boolean;

  // Propiedades opcionales para vistas detalladas (Cliente / Habitación incrustados)
  numero?: string;
  categoriaNombre?: string;
  pisoNombre?: string;
  tipoDocumento?: string;
  documento?: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
}
