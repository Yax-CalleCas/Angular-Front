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
    fechaEntrada: string;           // Mapeado desde LocalDate
    fechaSalida: string;            // Mapeado desde LocalDate
    fechaSalidaConfirmacion?: string | null; // Mapeado desde LocalDateTime
    precioInicial: number;
    adelanto: number;
    precioRestante: number;
    totalPagado: number;
    costoPenalidad: number;
    observacion?: string | null;
    estado: boolean;                // true = Activa, false = Finalizada
    fechaCreacion: string;          // Mapeado desde LocalDateTime
    fechaActualizacion?: string | null;

    // Opcionales de apoyo para tablas y listados visuales en Angular:
    numeroHabitacion?: string;
    nombreCliente?: string;
    apellidoCliente?: string;
    documentoCliente?: string;
    tipoDocumentoCliente?: string;
  }
