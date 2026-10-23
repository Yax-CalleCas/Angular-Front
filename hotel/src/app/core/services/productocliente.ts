// src/app/core/services/producto-cliente.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ProductoService } from './producto.service';
import { VentaService } from './venta.service'; // Asegúrate de tener este servicio si manejas ventas
import { ApiResponse } from '../models/ApiResponse';
import { Producto } from '../models/producto';
import { Venta } from '../models/Venta';

@Injectable({
  providedIn: 'root'
})
export class ProductoClienteService {
  private readonly productoService = inject(ProductoService);
  private readonly ventaService = inject(VentaService);
  private readonly http = inject(HttpClient);

  /**
   * Obtiene el catálogo de productos disponibles para la vista del cliente.
   * Utiliza el servicio base de productos.
   */
  obtenerCatalogo(): Observable<ApiResponse<Producto[]>> {
    return this.productoService.listar().pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Busca un producto específico por su ID desde la perspectiva del cliente.
   */
  obtenerProductoPorId(id: number): Observable<ApiResponse<Producto>> {
    return this.productoService.buscarPorId(id).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Envía o registra un pedido/venta realizado por el cliente.
   */
  enviarPedido(pedido: any): Observable<ApiResponse<Venta>> {
    return this.ventaService.guardar(pedido).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Manejador centralizado de errores para las peticiones del cliente.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Ocurrió un error inesperado.';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error del cliente: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || `Error del servidor: ${error.status}`;
    }

    console.error('ProductoClienteService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
