import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, NEVER, map, shareReplay } from 'rxjs';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import {
  ApiResponse,
  ReporteVentaDto,
  ProductoDto,
  RecepcionResponseDTO
} from '../models/reporte.models';
import { DashboardEstadisticas } from '../models/DashboardEstadisticas';

const TOKEN_KEY = 'token';
class ErrorFatal extends Error {}

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  // Proxy de Angular -> gateway (8089) -> reporte-service (8086)
  private readonly apiUrl = '/gateway/reporte-service/api/reportes';
  private readonly apiEstadisticasUrl = '/gateway/reporte-service/api/estadisticas';

  // --- INVENTARIO ---
  getProductosMasVendidos(): Observable<ReporteVentaDto[]> {
    return this.http
      .get<ApiResponse<ReporteVentaDto[]>>(`${this.apiUrl}/inventario/productos-mas-vendidos`)
      .pipe(map(res => res.data || []));
  }

  getStockBajo(umbral: number = 5): Observable<ProductoDto[]> {
    const params = new HttpParams().set('umbral', umbral.toString());
    return this.http
      .get<ApiResponse<ProductoDto[]>>(`${this.apiUrl}/inventario/stock-bajo`, { params })
      .pipe(map(res => res.data || []));
  }

  // --- RECEPCIÓN Y ALQUILERES ---
  getAlquileres(estado?: boolean): Observable<RecepcionResponseDTO[]> {
    let params = new HttpParams();
    if (estado !== undefined) {
      params = params.set('estado', estado.toString());
    }
    return this.http
      .get<ApiResponse<RecepcionResponseDTO[]>>(`${this.apiUrl}/recepcion/alquileres`, { params })
      .pipe(map(res => res.data || []));
  }

  getCuentasPorCobrar(): Observable<RecepcionResponseDTO[]> {
    return this.http
      .get<ApiResponse<RecepcionResponseDTO[]>>(`${this.apiUrl}/recepcion/cuentas-por-cobrar`)
      .pipe(map(res => res.data || []));
  }

  getResumenPenalidades(): Observable<any> {
    return this.http
      .get<ApiResponse<any>>(`${this.apiUrl}/recepcion/penalidades`)
      .pipe(map(res => res.data));
  }

  /**
   * NUEVO: Conexión SSE en tiempo real para reportes de recepción alineada con ReporteRecepcionController
   */
  streamReportesRecepcion(): Observable<any> {
    if (!isPlatformBrowser(this.platformId)) return NEVER;

    return new Observable<any>((subscriber) => {
      const ctrl = new AbortController();
      let intentos = 0;

      fetchEventSource(`${this.apiUrl}/recepcion/stream`, {
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
          throw new Error(`No se pudo abrir el stream de reportes (${res.status})`);
        },
        onmessage: (msg) => {
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

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = '/gateway/reporte-service/api/estadisticas';

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
