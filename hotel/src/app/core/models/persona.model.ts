import { Sede } from '../models/Sede/Sede';
 // Opcional si usas SedeDto

export interface Persona {
  idPersona?: number;
  tipoDocumento: string;
  documento: string;
  nombre: string;
  apellido: string;
  correo: string;
  fotoUrl?: string;
  clave?: string;
  idTipoPersona: number;
  sedes?: Sede[];
  estado?: boolean;
  fechaCreacion?: string;
}
