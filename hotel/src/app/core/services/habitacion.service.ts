import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { HabitacionResponseDTO, HabitacionRequestDTO } from '../models/Habitacion';

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8085/api/habitacion';

  private listarCache$?: Observable<ApiResponse<HabitacionResponseDTO[]>>;

  listar(): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  listarPorHotel(idHotel: number): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar/hotel/${idHotel}`);
  }

  private invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscarPorId(id: number): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/buscar/${id}`);
  }

  guardar(dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.post<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/registrar`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizar(id: number, dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.put<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizarEstado(idHabitacion: number, idEstado: number): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.patch<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/${idHabitacion}/estado/${idEstado}`, {}).pipe(
      tap(() => this.invalidateCache())
    );
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
