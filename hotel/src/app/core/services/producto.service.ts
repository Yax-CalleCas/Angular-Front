import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiResponse } from '../models/ApiResponse';
import { Producto } from '../models/producto';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  // Ruta relativa: el proxy de Angular (proxy.conf.json) la reenvía al gateway en el 8089
  private readonly apiUrl = '/gateway/inventario-productos/api/producto';
  private readonly http = inject(HttpClient);

  /** GET /api/producto/listar */
  listar(): Observable<ApiResponse<Producto[]>> {
    return this.http
      .get<ApiResponse<Producto[]>>(`${this.apiUrl}/listar`)
      .pipe(catchError(this.handleError));
  }

  /** GET /api/producto/{id} */
  buscarPorId(id: number): Observable<ApiResponse<Producto>> {
    return this.http
      .get<ApiResponse<Producto>>(`${this.apiUrl}/${id}`)
      .pipe(catchError(this.handleError));
  }

  /** POST /api/producto/registrar */
  registrar(dto: Producto): Observable<ApiResponse<Producto>> {
    return this.http
      .post<ApiResponse<Producto>>(`${this.apiUrl}/registrar`, dto)
      .pipe(catchError(this.handleError));
  }

  /** PUT /api/producto/actualizar/{id} */
  actualizar(id: number, dto: Producto): Observable<ApiResponse<Producto>> {
    return this.http
      .put<ApiResponse<Producto>>(`${this.apiUrl}/actualizar/${id}`, dto)
      .pipe(catchError(this.handleError));
  }

  /** PATCH /api/producto/{id}/stock/aumentar?cantidad={cantidad} */
  aumentarStock(id: number, cantidad: number): Observable<ApiResponse<Producto>> {
    const params = new HttpParams().set('cantidad', cantidad.toString());
    return this.http
      .patch<ApiResponse<Producto>>(`${this.apiUrl}/${id}/stock/aumentar`, {}, { params })
      .pipe(catchError(this.handleError));
  }

  /** DELETE /api/producto/eliminar/{id} */
  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http
      .delete<ApiResponse<null>>(`${this.apiUrl}/eliminar/${id}`)
      .pipe(catchError(this.handleError));
  }

  /** Manejador centralizado de errores HTTP. */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage: string;

    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else if (error.status === 0) {
      // Sin conexión o servidor caído
      errorMessage = 'No se pudo conectar con el servidor (revisa que el gateway esté levantado y el proxy configurado).';
    } else if (error.status === 401 || error.status === 403) {
      errorMessage = 'No autorizado: falta el token o ha expirado.';
    } else {
      errorMessage =
        error.error?.message || `Código de error: ${error.status}, mensaje: ${error.message}`;
    }

    console.error('ProductoService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
