import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NEVER, Observable, map, shareReplay } from 'rxjs';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { ApiResponse } from '../models/ApiResponse';
import { DashboardEstadisticas } from '../models/DashboardEstadisticas';

const API_URL = '/gateway/reporte-service';
const TOKEN_KEY = 'token';

class ErrorFatal extends Error {}

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = `${API_URL}/api/estadisticas`;

  obtenerSnapshot(): Observable<DashboardEstadisticas> {
    return this.http
      .get<ApiResponse<DashboardEstadisticas>>(this.baseUrl)
      .pipe(map((res) => res.data));
  }

  readonly estadisticas$: Observable<DashboardEstadisticas> = this.crearStream().pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private crearStream(): Observable<DashboardEstadisticas> {
    if (!isPlatformBrowser(this.platformId)) return NEVER;

    return new Observable<DashboardEstadisticas>((subscriber) => {
      const ctrl = new AbortController();
      let intentos = 0;

      fetchEventSource(`${this.baseUrl}/stream`, {
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
          Accept: 'text/event-stream',
        },

        onopen: async (res) => {
          if (res.ok && res.headers.get('content-type')?.includes('text/event-stream')) {
            intentos = 0;
            return;
          }
          if (res.status === 401 || res.status === 403) {
            throw new ErrorFatal(`Sin autorización (${res.status})`);
          }
          throw new Error(`No se pudo abrir el stream (${res.status})`);
        },

        onmessage: (msg) => {
          // Acepta mensajes iniciales, actualizaciones o eventos genéricos
          this.zone.run(() => {
            try {
              if (msg.data) {
                subscriber.next(JSON.parse(msg.data));
              }
            } catch (err) {
              subscriber.error(err);
            }
          });
        },

        onerror: (err) => {
          if (err instanceof ErrorFatal) throw err;
          intentos++;
          return Math.min(30_000, 1_000 * 2 ** intentos);
        },
      }).catch((err) => {
        if (ctrl.signal.aborted) return;
        this.zone.run(() => {
          if (err instanceof ErrorFatal) {
            localStorage.clear();
            this.router.navigate(['/login']);
          }
          subscriber.error(err);
        });
      });

      return () => ctrl.abort();
    });
  }
}
