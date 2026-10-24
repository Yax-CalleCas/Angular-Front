import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecepcionRequestDTO, RecepcionResponseDTO, SalidaRequest } from '../models/recepcion.model';
import { ApiResponse } from '../models/ApiResponse';

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/gateway/recepcion-service/api/recepcion';

  listar(estado?: boolean): Observable<ApiResponse<RecepcionResponseDTO[]>> {
    if (estado !== undefined) {
      const params = new HttpParams().set('estado', estado.toString());
      return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/listar`, { params });
    }
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/listar`);
  }

  listarPorCliente(idCliente: number): Observable<ApiResponse<RecepcionResponseDTO[]>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/cliente/${idCliente}`);
  }

  registrar(dto: RecepcionRequestDTO): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar`, dto);
  }

  registrarSalida(id: number, request: SalidaRequest): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar-salida/${id}`, request);
  }

  buscarPorId(id: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/${id}`);
  }

  buscarActivaPorHabitacion(idHabitacion: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/habitacion-activa/${idHabitacion}`);
  }

  actualizar(id: number, dto: Partial<RecepcionRequestDTO>): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.put<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
