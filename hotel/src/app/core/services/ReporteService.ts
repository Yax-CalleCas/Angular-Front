import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { timeout, catchError, map } from 'rxjs/operators';
import { DashboardStatsDto } from '../models/DashboardStatsDto';
import { ReporteProductoDto, ReporteVentaDto, ReporteHabitacionDto, ReporteCobroDto } from '../models/reporte.models';

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly API_URL = 'http://localhost:8081/api/reportes';
  private readonly TIMEOUT_MS = 15000; // Aumentado ligeramente para reportes complejos

  constructor(private http: HttpClient) { }

  private request<T>(endpoint: string, params: HttpParams = new HttpParams()): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.API_URL}/${endpoint}`, { params }).pipe(
      timeout(this.TIMEOUT_MS),
      map(res => {
        if (!res.success) throw new Error(res.message || 'Error en la respuesta del servidor');
        return res.data;
      }),
      catchError(err => {
        console.error('ReporteService Error:', err);
        return throwError(() => new Error(err.message || 'Error de conexión'));
      })
    );
  }

  getProductosBajoStock(limite: number): Observable<ReporteProductoDto[]> {
    return this.request<ReporteProductoDto[]>('productos-bajo-stock', new HttpParams().set('limite', limite.toString()));
  }

  getVentas(inicio: string, fin: string): Observable<ReporteVentaDto[]> {
    return this.request<ReporteVentaDto[]>('ventas', this.createDateParams(inicio, fin));
  }

  getOcupacion(inicio: string, fin: string): Observable<ReporteHabitacionDto[]> {
    return this.request<ReporteHabitacionDto[]>('ocupacion', this.createDateParams(inicio, fin));
  }

  getCobros(inicio: string, fin: string): Observable<ReporteCobroDto[]> {
    return this.request<ReporteCobroDto[]>('cobros', this.createDateParams(inicio, fin));
  }

  getDashboardStats(): Observable<DashboardStatsDto> {
    return this.request<DashboardStatsDto>('dashboard');
  }

  // Helper para estandarizar parámetros de fecha
  private createDateParams(inicio: string, fin: string): HttpParams {
    return new HttpParams().set('inicio', inicio).set('fin', fin);
  }
}
