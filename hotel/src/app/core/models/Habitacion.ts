import { EstadoHabitacionResponseDTO } from './estado-habitacion.model';
import { ImagenHabitacionDTO } from './/ImagenHabitacionDTO';
// Nota: Importa o define de manera similar las interfaces de PisoResponseDTO y CategoriaResponseDTO cuando las implementes.

export interface HabitacionResponseDTO {
  idHabitacion: number;
  idHotel: number;
  numero: string;
  detalle?: string;
  precio: number;
  estadoHabitacion: EstadoHabitacionResponseDTO;
  piso: any; // Se tipará con PisoResponseDTO en cuanto se integre
  categoria: any; // Se tipará con CategoriaResponseDTO en cuanto se integre
  imagenes: ImagenHabitacionDTO[];
  estado: boolean;
}

export interface HabitacionRequestDTO {
  idHotel: number;
  numero: string;
  detalle?: string;
  precio: number;
  idEstadoHabitacion: number;
  idPiso: number;
  idCategoria: number;
  urlsImagenes?: string[];
}
