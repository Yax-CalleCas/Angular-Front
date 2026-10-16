export interface OperacionConsulta {
  blockId: string;
  idHabitacion: number;
  tipo: 'MANTENIMIENTO' | 'BAJA';
  estado: 'PREPARANDO' | 'APLICADA' | 'LIBERADA' | 'RECHAZADA';
}
