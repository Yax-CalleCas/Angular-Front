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
  // Ajusta el puerto o la URL base según tu entorno (Gateway o microservicio de inventario directo)
  private readonly baseUrl = 'http://localhost:8000/api/venta';

  // Listar todas las ventas
  listar(): Observable<ApiResponse<Venta[]>> {
    return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}/listar`);
  }

  listarTodos(): Observable<ApiResponse<Venta[]>> {
    return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}/listar`);
  }

  // Buscar venta por ID
  buscarPorId(id: number): Observable<ApiResponse<Venta>> {
    return this.http.get<ApiResponse<Venta>>(`${this.baseUrl}/${id}`);
  }

  // Listar ventas por recepción
  buscarPorRecepcion(idRecepcion: number): Observable<ApiResponse<Venta[]>> {
    return this.http.get<ApiResponse<Venta[]>>(`${this.baseUrl}/recepcion/${idRecepcion}`);
  }

  // Registrar una nueva venta
  guardar(venta: Venta): Observable<ApiResponse<Venta>> {
    return this.http.post<ApiResponse<Venta>>(`${this.baseUrl}/registrar`, venta);
  }

  // Actualizar una venta existente
  actualizar(id: number, venta: Venta): Observable<ApiResponse<Venta>> {
    return this.http.put<ApiResponse<Venta>>(`${this.baseUrl}/actualizar/${id}`, venta);
  }

  // Eliminar una venta
  eliminar(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/eliminar/${id}`);
  }
}
