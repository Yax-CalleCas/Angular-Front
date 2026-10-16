export interface LimpiezaTarea {
  cleaningCycleId: string;
  idHabitacion: number;
  idRecepcion: number;
  estado: 'PENDIENTE' | 'COMPLETADA';
  roomVersion: number;
  version: number;
}
