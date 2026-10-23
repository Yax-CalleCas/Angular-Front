export interface EstadoHabitacionResponseDTO {
  idEstadoHabitacion: number;
  codigo: string;
  descripcion: string;
  estado: boolean;
}

export interface EstadoHabitacionRequestDTO {
  codigo: string;
  descripcion: string;
  estado: boolean;
}

export interface ImagenHabitacionDTO {
  idImagen?: number;
  urlImagen: string;
}

export interface PisoResponseDTO {
  idPiso: number;
  idHotel: number;
  descripcion: string;
  estado: boolean;
}

export interface CategoriaResponseDTO {
  idCategoria: number;
  descripcion: string;
  estado: boolean;
}

export interface HabitacionResponseDTO {
  idHabitacion: number;
  idHotel: number;
  numero: string;
  detalle?: string;
  precio: number;
  estadoHabitacion: EstadoHabitacionResponseDTO;
  piso: PisoResponseDTO;
  categoria: CategoriaResponseDTO;
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
