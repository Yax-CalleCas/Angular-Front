import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { ApiResponse } from '../../../app/core/models/ApiResponse';
import { Piso } from '../../../app/core/models/piso';

@Injectable({ providedIn: 'root' })
export class PisoService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/gateway/habitaciones/api/piso';

  private listarCache$?: Observable<ApiResponse<Piso[]>>;
  private readonly porHotelCache = new Map<number, Observable<ApiResponse<Piso[]>>>();

  listar(): Observable<ApiResponse<Piso[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http
        .get<ApiResponse<Piso[]>>(`${this.baseUrl}/listar`)
        .pipe(shareReplay(1));
    }
    return this.listarCache$;
  }

  listarPorHotel(idHotel: number): Observable<ApiResponse<Piso[]>> {
    let cache$ = this.porHotelCache.get(idHotel);
    if (!cache$) {
      cache$ = this.http
        .get<ApiResponse<Piso[]>>(`${this.baseUrl}/listar/hotel/${idHotel}`)
        .pipe(shareReplay(1));
      this.porHotelCache.set(idHotel, cache$);
    }
    return cache$;
  }

  invalidateCache(): void {
    this.listarCache$ = undefined;
    this.porHotelCache.clear();
  }

  buscar(id: number): Observable<ApiResponse<Piso>> {
    return this.http.get<ApiResponse<Piso>>(`${this.baseUrl}/buscar/${id}`);
  }

  registrar(piso: Piso): Observable<ApiResponse<Piso>> {
    return this.http
      .post<ApiResponse<Piso>>(`${this.baseUrl}/registrar`, piso)
      .pipe(tap(() => this.invalidateCache()));
  }

  actualizar(id: number, piso: Piso): Observable<ApiResponse<Piso>> {
    return this.http
      .put<ApiResponse<Piso>>(`${this.baseUrl}/actualizar/${id}`, piso)
      .pipe(tap(() => this.invalidateCache()));
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`)
      .pipe(tap(() => this.invalidateCache()));
  }
}
