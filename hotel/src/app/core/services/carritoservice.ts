import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Carrito } from '../models/Carrito';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {

  private readonly http = inject(HttpClient);
  private readonly url = 'http://localhost:8081/api/carrito';

  private carritoSubject = new BehaviorSubject<Carrito[]>([]);
  carrito$ = this.carritoSubject.asObservable();

  // =========================
  // AGREGAR AL CARRITO
  // =========================
  agregarAlCarrito(idRecepcion: number, idProducto: number, cantidad: number): Observable<any> {

    const params = new HttpParams()
      .set('idRecepcion', idRecepcion.toString())
      .set('idProducto', idProducto.toString())
      .set('cantidad', cantidad.toString());

    return this.http.post(
      `${this.url}/agregar`,
      null,
      { params, responseType: 'text' as 'json' }
    ).pipe(
      tap(() => this.actualizarCarrito(idRecepcion))
    );
  }

  // =========================
  // CARGAR CARRITO
  // =========================
  actualizarCarrito(idRecepcion: number): void {

    this.http.get<Carrito[]>(
      `${this.url}/listar/${idRecepcion}`
    ).subscribe({
      next: (data) => this.carritoSubject.next(data),
      error: (err) => {
        console.error('Error al cargar carrito:', err);
        this.carritoSubject.next([]);
      }
    });
  }

  // =========================
  // ELIMINAR PRODUCTO
  // =========================
  eliminarProducto(idRecepcion: number, idProducto: number): Observable<void> {

    const params = new HttpParams()
      .set('idRecepcion', idRecepcion.toString())
      .set('idProducto', idProducto.toString());

    return this.http.delete<void>(
      `${this.url}/eliminar`,
      { params }
    ).pipe(
      tap(() => this.actualizarCarrito(idRecepcion))
    );
  }
}
