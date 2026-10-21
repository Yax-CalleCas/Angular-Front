  export interface RecepcionRequestDTO {
    idCliente: number;
    idHabitacion: number;
    fechaEntrada: string; // Formato 'YYYY-MM-DD'
    fechaSalida: string;  // Formato 'YYYY-MM-DD'
    precioInicial: number;
    adelanto?: number;
    observacion?: string;
  }

  export interface SalidaRequest {
    idRecepcion: number;
    costoPenalidad?: number;
    observacion?: string;
  }

  export interface RecepcionResponseDTO {
  idRecepcion: number;
  idCliente: number;
  idHabitacion: number;
  fechaEntrada: string;
  fechaSalida: string;
  fechaSalidaConfirmacion?: string | null;
  precioInicial: number;
  adelanto: number;
  precioRestante: number;
  totalPagado: number;
  costoPenalidad: number;
  observacion?: string | null;
  estado: boolean;
  fechaCreacion: string;
  fechaActualizacion?: string | null;

  // Opcionales de apoyo visual
  numeroHabitacion?: string;
  nombreCliente?: string;
  apellidoCliente?: string;
  documentoCliente?: string;
  documento?: string;         // Fallback si el backend devuelve 'documento'
  correoCliente?: string;    // Agregado para el correo
  correo?: string;           // Fallback si el backend devuelve 'correo'
  tipoDocumentoCliente?: string;
}
