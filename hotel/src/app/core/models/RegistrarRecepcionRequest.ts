export interface RegistrarRecepcionRequest {
  idCliente: number;
  idHabitacion: number;
  fechaSalida: string;          // 'YYYY-MM-DD'
  precioInicial: number;
  adelanto?: number;
  observacion?: string | null;
}
