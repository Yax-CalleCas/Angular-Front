import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { Recepcion } from '../models/recepcion.model';

export interface RegistrarRecepcionRequest {
  idCliente: number;
  idHabitacion: number;
  fechaSalida: string;          // 'YYYY-MM-DD'
  precioInicial: number;
  adelanto?: number;
  observacion?: string | null;
  nombre?: string;              // opcional: se guarda como snapshot del nombre
  apellido?: string;
}

export interface SalidaRequest {
  idRecepcion: number;
  idHabitacion: number;
  costoPenalidad?: number;
  totalPagado?: number;
}

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8084/api/recepcion'; // mover a environment.ts

  listar(): Observable<ApiResponse<Recepcion[]>> {
    return this.http.get<ApiResponse<Recepcion[]>>(`${this.baseUrl}/listar`);
  }

  listarPorCliente(idCliente: number): Observable<ApiResponse<Recepcion[]>> {
    return this.http.get<ApiResponse<Recepcion[]>>(`${this.baseUrl}/cliente/${idCliente}`);
  }

registrar(dto: RegistrarRecepcionRequest | Recepcion): Observable<ApiResponse<Recepcion>> {
  return this.http.post<ApiResponse<Recepcion>>(`${this.baseUrl}/registrar`, dto);
}

  registrarSalida(data: SalidaRequest): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.baseUrl}/registrar-salida`, data);
  }

  buscarPorId(id: number): Observable<ApiResponse<Recepcion>> {
    return this.http.get<ApiResponse<Recepcion>>(`${this.baseUrl}/${id}`);
  }

  buscarActivaPorHabitacion(idHabitacion: number): Observable<ApiResponse<Recepcion>> {
    return this.http.get<ApiResponse<Recepcion>>(`${this.baseUrl}/habitacion-activa/${idHabitacion}`);
  }

  actualizar(id: number, dto: Partial<Recepcion>): Observable<ApiResponse<Recepcion>> {
    return this.http.put<ApiResponse<Recepcion>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
