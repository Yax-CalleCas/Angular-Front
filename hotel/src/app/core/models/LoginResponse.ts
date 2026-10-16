import { Sede } from '../models/Sede/Sede';

export interface LoginResponse {
  idPersona: number;
  nombre: string;
  apellido: string;
  correo: string;
  tipoPersona: string;
  sedes: Sede[];
  token: string;
}
