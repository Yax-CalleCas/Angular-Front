import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse'; // Ajusta la ruta según tu estructura de carpetas
import { Habitacion } from '../models/Habitacion';     // Ajusta la ruta según tu estructura de carpetas

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8081/api/habitacion'; // Ajusta el puerto o URL de tu hotel-service

  // Caché opcional para optimizar listados frecuentes en el tablero
  private listarCache$?: Observable<ApiResponse<Habitacion[]>>;

  listar(): Observable<ApiResponse<Habitacion[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<ApiResponse<Habitacion[]>>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  private invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscarPorId(id: number): Observable<ApiResponse<Habitacion>> {
    return this.http.get<ApiResponse<Habitacion>>(`${this.baseUrl}/buscar/${id}`);
  }

  guardar(dto: Habitacion): Observable<ApiResponse<Habitacion>> {
    return this.http.post<ApiResponse<Habitacion>>(`${this.baseUrl}/registrar`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizar(id: number, dto: Partial<Habitacion>): Observable<ApiResponse<Habitacion>> {
    return this.http.put<ApiResponse<Habitacion>>(`${this.baseUrl}/actualizar/${id}`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  /**
   * Método que permite actualizar de manera rápida el estado de la habitación
   * (Ej: Cambiar a Ocupado ID 2 o Disponible ID 1) conectando con el @PatchMapping del backend.
   */
actualizarEstado(idHabitacion: number, idEstado: number): Observable<ApiResponse<Habitacion>> {
    return this.http.patch<ApiResponse<Habitacion>>(`${this.baseUrl}/${idHabitacion}/estado/${idEstado}`, {}).pipe(
      tap(() => this.invalidateCache())
    );
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
