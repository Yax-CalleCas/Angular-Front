import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Carrito } from '../models/Carrito';
import { ApiResponse } from '../models/ApiResponse';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private readonly url = '/gateway/inventario-productos/api/carrito';
  private readonly http = inject(HttpClient);

  private carritoSubject = new BehaviorSubject<Carrito[]>([]);
  carrito$ = this.carritoSubject.asObservable();


  // AGREGAR AL CARRITO
  agregarAlCarrito(idRecepcion: number, idProducto: number, cantidad: number): Observable<ApiResponse<Boolean>> {
    const params = new HttpParams()
      .set('idRecepcion', idRecepcion.toString())
      .set('idProducto', idProducto.toString())
      .set('cantidad', cantidad.toString());

    return this.http.post<ApiResponse<Boolean>>(
      `${this.url}/agregar`,
      null,
      { params }
    ).pipe(
      tap(() => this.actualizarCarrito(idRecepcion))
    );
  }


  // CARGAR CARRITO
  actualizarCarrito(idRecepcion: number): void {
    this.http.get<ApiResponse<Carrito[]>>(
      `${this.url}/listar/${idRecepcion}`
    ).subscribe({
      next: (response) => {
        this.carritoSubject.next(response.data ?? []);
      },
      error: (err) => {
        console.error('Error al cargar carrito:', err);
        this.carritoSubject.next([]);
      }
    });
  }

  eliminarProducto(idRecepcion: number, idProducto: number): Observable<ApiResponse<void>> {
    const params = new HttpParams()
      .set('idRecepcion', idRecepcion.toString())
      .set('idProducto', idProducto.toString());

    return this.http.delete<ApiResponse<void>>(
      `${this.url}/eliminar`,
      { params }
    ).pipe(
      tap(() => this.actualizarCarrito(idRecepcion))
    );
  }
}
