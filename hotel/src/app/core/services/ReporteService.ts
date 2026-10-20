import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  private readonly apiUrl = 'http://localhost:8086/api/reportes';

  // --- INVENTARIO ---
  getProductosMasVendidos(): Observable<ReporteVentaDto[]> {
    return this.http.get<ApiResponse<ReporteVentaDto[]>>(`${this.apiUrl}/inventario/productos-mas-vendidos`)
      .pipe(map(res => res.data || []));
  }

  // 💡 Nombre unificado a getStockBajo para que coincida con el componente
  getStockBajo(umbral: number = 5): Observable<ProductoDto[]> {
    return this.http.get<ApiResponse<ProductoDto[]>>(`${this.apiUrl}/inventario/stock-bajo?umbral=${umbral}`)
      .pipe(map(res => res.data || []));
  }

  // --- RECEPCIÓN Y ALQUILERES ---
  getAlquileres(estado?: boolean): Observable<RecepcionResponseDTO[]> {
    const url = estado !== undefined ? `${this.apiUrl}/recepcion/alquileres?estado=${estado}` : `${this.apiUrl}/recepcion/alquileres`;
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(url)
      .pipe(map(res => res.data || []));
  }

  getCuentasPorCobrar(): Observable<RecepcionResponseDTO[]> {
    return this.http.get<ApiResponse<RecepcionResponseDTO[]>>(`${this.apiUrl}/recepcion/cuentas-por-cobrar`)
      .pipe(map(res => res.data || []));
  }

  getResumenPenalidades(): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/recepcion/penalidades`)
      .pipe(map(res => res.data));
  }
}
