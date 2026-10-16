import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models/ApiResponse';
import { Venta } from '../models/Venta';

@Injectable({
  providedIn: 'root'
})
export class VentaService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8081/api/venta';

  // MÉTODO AGREGADO: Requerido por el componente de Procesar Salida
  listar(): Observable<ApiResponse<Venta[]>> {
    return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}`);
  }

  // Listar todas las ventas (Mantenido por si lo usas en otros componentes)
  listarTodos(): Observable<ApiResponse<Venta[]>> {
    return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}`);
  }

  // Buscar venta por ID
  buscarPorId(id: number): Observable<ApiResponse<Venta>> {
    return this.http.get<ApiResponse<Venta>>(`${this.baseUrl}/${id}`);
  }

buscarPorRecepcion(idRecepcion: number): Observable<ApiResponse<Venta[]>> {
  return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}/recepcion/${idRecepcion}`);
}

  // Registrar una nueva venta
  guardar(venta: any): Observable<ApiResponse<Venta>> {
    return this.http.post<ApiResponse<Venta>>(`${this.baseUrl}`, venta);
  }

  // Actualizar una venta existente
  actualizar(id: number, venta: Venta): Observable<ApiResponse<Venta>> {
    return this.http.put<ApiResponse<Venta>>(`${this.baseUrl}/${id}`, venta);
  }

  // Eliminar una venta
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
