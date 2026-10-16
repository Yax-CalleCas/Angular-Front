import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';

import { ApiResponse } from '../../../app/core/models/ApiResponse';
import { Piso } from '../../../app/core/models/piso';

@Injectable({ providedIn: 'root' })
export class PisoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8085/api/piso';
  private listarCache$?: Observable<ApiResponse<Piso[]>>;

  listar(): Observable<ApiResponse<Piso[]>> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<ApiResponse<Piso[]>>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  private invalidateCache(): void {
    this.listarCache$ = undefined;
  }

  buscar(id: number): Observable<ApiResponse<Piso>> {
    return this.http.get<ApiResponse<Piso>>(`${this.baseUrl}/buscar/${id}`);
  }

  registrar(piso: Piso): Observable<ApiResponse<Piso>> {
    return this.http.post<ApiResponse<Piso>>(`${this.baseUrl}/registrar`, piso).pipe(
      tap(() => this.invalidateCache())
    );
  }

  actualizar(id: number, piso: Piso): Observable<ApiResponse<Piso>> {
    return this.http.put<ApiResponse<Piso>>(`${this.baseUrl}/actualizar/${id}`, piso).pipe(
      tap(() => this.invalidateCache())
    );
  }

  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/eliminar/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
