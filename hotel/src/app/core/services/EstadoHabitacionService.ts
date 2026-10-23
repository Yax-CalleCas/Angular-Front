import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { EstadoHabitacionResponseDTO, EstadoHabitacionRequestDTO } from '../models/Habitacion';

@Injectable({ providedIn: 'root' })
export class EstadoHabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/gateway/habitaciones/api/estadohabitacion';

  listar(): Observable<ApiResponse<EstadoHabitacionResponseDTO[]>> {
    return this.http.get<ApiResponse<EstadoHabitacionResponseDTO[]>>(`${this.baseUrl}/listar`);
  }

  buscarPorId(id: number): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.get<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/buscar/${id}`);
  }

  guardar(dto: EstadoHabitacionRequestDTO): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.post<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/registrar`, dto);
  }

  registrar(dto: EstadoHabitacionRequestDTO): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.guardar(dto); // Alias por si algún componente llama a .registrar()
  }

  actualizar(id: number, dto: EstadoHabitacionRequestDTO): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.put<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
