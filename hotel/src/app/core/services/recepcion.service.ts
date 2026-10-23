import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RecepcionRequestDTO, RecepcionResponseDTO, SalidaRequest } from '../models/recepcion.model';
import { ApiResponse } from '../models/ApiResponse';

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/gateway/recepcion-service/api/recepcion';

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

  /** Historial de recepciones de un cliente. */
  listarPorCliente(idCliente: number): Observable<ApiResponse<RecepcionResponseDTO[]>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.baseUrl}/cliente/${idCliente}`);
  }

  /** Registra una nueva entrada (Check-in). */
  registrar(dto: RecepcionRequestDTO): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar`, dto);
  }

  /** Procesa la salida (Check-out) y registra penalidades si aplica. */
  registrarSalida(id: number, request: SalidaRequest): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.post<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/registrar-salida/${id}`, request);
  }

  /** Busca una recepción por su ID. */
  buscarPorId(id: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/${id}`);
  }

  /** Busca la recepción activa de una habitación. */
  buscarActivaPorHabitacion(idHabitacion: number): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.get<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/habitacion-activa/${idHabitacion}`);
  }

  /** Actualiza una recepción existente. */
  actualizar(id: number, dto: Partial<RecepcionRequestDTO>): Observable<ApiResponse<RecepcionResponseDTO>> {
    return this.http.put<ApiResponse<RecepcionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  /** Elimina un registro de recepción. */
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
