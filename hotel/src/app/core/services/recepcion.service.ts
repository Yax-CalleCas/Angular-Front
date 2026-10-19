import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecepcionRequestDTO, RecepcionResponseDTO, SalidaRequest } from '../models/recepcion.model';
import { ApiResponse } from '../models/ApiResponse';

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8084/api/recepcion'; // Idealmente mover a environment.ts

  /**
   * Lista todas las recepciones o filtra opcionalmente por estado.
   * @param estado true = Activas (En estancia), false = Finalizadas (Check-out)
   */
  listar(estado?: boolean): Observable<ApiResponse<RecepcionResponseDTO[]>> {
    let params = new HttpParams();
    if (estado !== undefined) {
      params = params.set('estado', estado.toString());
    }
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/listar`, { params });
  }

  /**
   * Obtiene el historial de recepciones asociadas a un cliente específico.
   */
  listarPorCliente(idCliente: number): Observable<ApiResponse<RecepcionResponseDTO[]>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/cliente/${idCliente}`);
  }

  /**
   * Registra una nueva entrada (Check-in).
   */
  registrar(dto: RecepcionRequestDTO): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar`, dto);
  }

  /**
   * Procesa la salida (Check-out) y registra penalidades si aplica.
   */
  registrarSalida(data: SalidaRequest): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar-salida`, data);
  }

  /**
   * Busca los datos de una recepción específica por su ID.
   */
  buscarPorId(id: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/${id}`);
  }

  /**
   * Busca si una habitación cuenta con una recepción activa en curso.
   */
  buscarActivaPorHabitacion(idHabitacion: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/habitacion-activa/${idHabitacion}`);
  }

  /**
   * Actualiza los datos de una recepción existente.
   */
  actualizar(id: number, dto: Partial<RecepcionRequestDTO>): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.put<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  /**
   * Elimina un registro de recepción por su ID.
   */
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
