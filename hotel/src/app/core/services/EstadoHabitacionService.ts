import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { ApiResponse } from '../../core/models/ApiResponse';
import { EstadoHabitacion } from '../models/estado-habitacion.model';

@Injectable({ providedIn: 'root' })
export class EstadoHabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8085/api/estadohabitacion';
  private listarCache$?: Observable<ApiResponse<EstadoHabitacion[]>>;

  listar(): Observable<ApiResponse<EstadoHabitacion[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<ApiResponse<EstadoHabitacion[]>>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  private invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscar(id: number): Observable<ApiResponse<EstadoHabitacion>> {
    return this.http.get<ApiResponse<EstadoHabitacion>>(`${this.baseUrl}/buscar/${id}`);
  }

  registrar(estado: EstadoHabitacion): Observable<ApiResponse<EstadoHabitacion>> {
    return this.http.post<ApiResponse<EstadoHabitacion>>(`${this.baseUrl}/registrar`, estado).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizar(id: number, estado: EstadoHabitacion): Observable<ApiResponse<EstadoHabitacion>> {
    return this.http.put<ApiResponse<EstadoHabitacion>>(`${this.baseUrl}/actualizar/${id}`, estado).pipe(
      tap(() => this.invalidateCache())
    );
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
