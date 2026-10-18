import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { ApiResponse } from '../../core/models/ApiResponse';
import { EstadoHabitacionResponseDTO } from '../models/estado-habitacion.model';

@Injectable({ providedIn: 'root' })
export class EstadoHabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8085/api/estadohabitacion';
  private listarCache$?: Observable<ApiResponse<EstadoHabitacionResponseDTO[]>>;

  listar(): Observable<ApiResponse<EstadoHabitacionResponseDTO[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<ApiResponse<EstadoHabitacionResponseDTO[]>>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  private invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscar(id: number): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.get<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/buscar/${id}`);
  }

  registrar(estado: EstadoHabitacionResponseDTO): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.post<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/registrar`, estado).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizar(id: number, estado: EstadoHabitacionResponseDTO): Observable<ApiResponse<EstadoHabitacionResponseDTO>> {
    return this.http.put<ApiResponse<EstadoHabitacionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, estado).pipe(
      tap(() => this.invalidateCache())
    );
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
