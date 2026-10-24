import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, share, timer } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { HabitacionResponseDTO, HabitacionRequestDTO } from '../models/Habitacion';

const SSE_REINTENTO_MS = 3000;
// Tiempo que se mantiene abierto el stream tras cerrarse el último suscriptor (cambios rápidos de pantalla).
const SSE_GRACIA_MS = 10000;

@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/gateway/habitaciones/api/habitacion';
  private cambiosCompartidos$?: Observable<HabitacionResponseDTO>;

  listar(): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar`);
  }

  listarPorHotel(idHotel: number): Observable<ApiResponse<HabitacionResponseDTO[]>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO[]>>(`${this.baseUrl}/listar/hotel/${idHotel}`);
  }

  buscarPorId(id: number): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.get<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/buscar/${id}`);
  }

  guardar(dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.post<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/registrar`, dto);
  }

  actualizar(id: number, dto: HabitacionRequestDTO): Observable<ApiResponse<HabitacionResponseDTO>> {
    return this.http.put<ApiResponse<HabitacionResponseDTO>>(`${this.baseUrl}/actualizar/${id}`, dto);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`);
  }

  /**
   * Stream SSE de cambios de habitaciones.
   * - Es UNA sola conexión compartida por toda la app: si cambias de pantalla y la nueva
   *   se suscribe dentro de 10 s, reutiliza la conexión en vez de abrir otra y dejar la
   *   anterior colgada en el gateway.
   * - Se cierra (abort) al desuscribirse, liberando la conexión del navegador.
   * - Reintenta cada 3 s si el servidor corta la conexión.
   * - Ignora eventos que no sean JSON de habitación (ej. "connected", heartbeats)
   *   en lugar de tumbar el stream y reconectar en bucle.
   */
  obtenerCambiosTiempoReal(): Observable<HabitacionResponseDTO> {
    this.cambiosCompartidos$ ??= this.crearStreamSse().pipe(
      share({
        resetOnError: true,
        resetOnComplete: true,
        resetOnRefCountZero: () => timer(SSE_GRACIA_MS)
      })
    );
    return this.cambiosCompartidos$;
  }

  private crearStreamSse(): Observable<HabitacionResponseDTO> {
    return new Observable<HabitacionResponseDTO>(observer => {
      if (typeof window === 'undefined') {
        observer.complete();
        return undefined;
      }

      const controller = new AbortController();
      let cerrado = false;

      const procesarBloque = (bloque: string): void => {
        const data = bloque.split(/\r?\n/)
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim())
          .join('\n');
        if (!data) return;

        let evento: HabitacionResponseDTO;
        try {
          evento = JSON.parse(data) as HabitacionResponseDTO;
        } catch {
          return; // evento no JSON: se ignora
        }
        if (evento && typeof evento === 'object' && evento.idHabitacion != null) {
          observer.next(evento);
        }
      };

      const conectar = async (): Promise<void> => {
        while (!cerrado) {
          try {
            const token = localStorage.getItem('token');
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
              for (const bloque of bloques) procesarBloque(bloque);
            }
          } catch {
            if (cerrado) return;
          }
          if (!cerrado) await new Promise(r => setTimeout(r, SSE_REINTENTO_MS));
        }
      };

      void conectar();
      return () => { cerrado = true; controller.abort(); };
    });
  }
}
