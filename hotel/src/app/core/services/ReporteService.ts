import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiResponse,
  ReporteVentaDto,
  ProductoDto,
  RecepcionResponseDTO
} from '../models/reporte.models';

@Injectable({
  providedIn: 'root'
})
export class ReporteService {
  private readonly http = inject(HttpClient);

  // Proxy de Angular -> gateway (8089) -> reporte-service (8086)
  private readonly apiUrl = '/gateway/reporte-service/api/reportes';

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
}
