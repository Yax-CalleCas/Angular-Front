export interface RegistroClienteDto {
  tipoDocumento: string;
  documento: string;
  nombre: string;
  apellido: string;
  correo: string;
  clave: string;
  fotoUrl?: string;
}
