import { Sede } from '../models/Sede/Sede';

export interface LoginRequest {
  correo: string;
  clave: string;
}

export interface LoginResponse {
  idPersona: number;
  nombre: string;
  apellido: string;
  correo: string;
  tipoPersona: string;
  sedes: Sede[];
  token: string;
}

export interface RegistroClienteDto {
  tipoDocumento: string;
  documento: string;
  nombre: string;
  apellido: string;
  correo: string;
  clave: string;
  fotoUrl?: string;
}
