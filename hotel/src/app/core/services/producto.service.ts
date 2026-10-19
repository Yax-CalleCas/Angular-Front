import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/ApiResponse';
import { Producto } from '../models/producto';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly url = 'http://localhost:8000/api/producto';
  private readonly http = inject(HttpClient);

  listar(): Observable<ApiResponse<Producto[]>> {
    return this.http.get<ApiResponse<Producto[]>>(`${this.url}/listar`);
  }

  buscarPorId(id: number): Observable<ApiResponse<Producto>> {
    return this.http.get<ApiResponse<Producto>>(`${this.url}/${id}`);
  }

  registrar(dto: Producto): Observable<ApiResponse<Producto>> {
    return this.http.post<ApiResponse<Producto>>(`${this.url}/registrar`, dto);
  }

  actualizar(id: number, dto: Producto): Observable<ApiResponse<Producto>> {
    return this.http.put<ApiResponse<Producto>>(`${this.url}/actualizar/${id}`, dto);
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.url}/eliminar/${id}`);
  }
}
