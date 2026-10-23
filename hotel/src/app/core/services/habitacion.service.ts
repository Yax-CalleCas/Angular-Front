// src/app/core/services/habitacion.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { HabitacionResponseDTO, HabitacionRequestDTO } from '../models/Habitacion';

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/gateway/habitaciones/api/habitacion';

  private listarCache$?: Observable<ApiResponse<HabitacionResponseDTO[]>>;

  listar(): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http
        .get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar`)
        .pipe(shareReplay(1));
    }
    return this.listarCache$;
  }

  listarPorHotel(idHotel: number): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar/hotel/${idHotel}`);
  }

  invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscarPorId(id: number): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/buscar/${id}`);
  }

  guardar(dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http
      .post<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/registrar`, dto)
      .pipe(tap(() => this.invalidateCache()));
  }

  actualizar(id: number, dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http
      .put<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto)
      .pipe(tap(() => this.invalidateCache()));
  }

  actualizarEstado(idHabitacion: number, idEstado: number): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http
      .patch<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/${idHabitacion}/estado/${idEstado}`, {})
      .pipe(tap(() => this.invalidateCache()));
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`)
      .pipe(tap(() => this.invalidateCache()));
  }

  /**
   * SSE con fetch: permite enviar el header Authorization (EventSource no puede)
   * y lee los eventos con nombre ("cambio-habitacion"). Reconecta sola.
   */
  obtenerCambiosTiempoReal(): Observable<HabitacionResponseDTO> {
    return new Observable<HabitacionResponseDTO>(observer => {
      const controller = new AbortController();
      let cerrado = false;

      const conectar = async () => {
        while (!cerrado) {
          try {
            const token = localStorage.getItem('token'); // <-- AJUSTAR a la clave real de tu login
            const resp = await fetch(`${this.baseUrl}/stream`, {
              headers: {
                Accept: 'text/event-stream',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              signal: controller.signal
            });

            if (resp.status === 401 || resp.status === 403) {
              observer.error(new Error(`SSE no autorizado (${resp.status})`));
              return;
            }
            if (!resp.ok || !resp.body) throw new Error(`SSE HTTP ${resp.status}`);

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const bloques = buffer.split(/\r?\n\r?\n/);
              buffer = bloques.pop() ?? '';
              for (const bloque of bloques) {
                const data = bloque.split(/\r?\n/)
                  .filter(l => l.startsWith('data:'))
                  .map(l => l.slice(5).trim())
                  .join('\n');
                if (data) observer.next(JSON.parse(data));
              }
            }
          } catch {
            if (cerrado) return;
          }
          if (!cerrado) await new Promise(r => setTimeout(r, 3000));
        }
      };

      conectar();
      return () => { cerrado = true; controller.abort(); };
    });
  }
}
