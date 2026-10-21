import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { Persona } from '../models/persona.model';

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly http = inject(HttpClient);

  // Proxy de Angular -> gateway (8089) -> auth-service (8081)
  private readonly baseUrl = '/gateway/auth-service/api/persona';
  private listarCache$?: Observable<Persona[]>;

  listar(): Observable<Persona[]> {
    if (!this.listarCache$) {
      this.listarCache$ = this.http.get<Persona[]>(`${this.baseUrl}/listar`).pipe(
        shareReplay(1)
      );
    }
    return this.listarCache$;
  }

  obtenerPorId(id: number): Observable<Persona> {
    return this.http.get<Persona>(`${this.baseUrl}/buscar/${id}`);
  }

  crear(persona: Persona): Observable<Persona> {
    return this.http.post<Persona>(`${this.baseUrl}/registrar`, persona).pipe(
      tap(() => this.limpiarCache())
    );
  }

  actualizar(id: number, persona: Persona): Observable<Persona> {
    return this.http.put<Persona>(`${this.baseUrl}/actualizar/${id}`, persona).pipe(
      tap(() => this.limpiarCache())
    );
  }

  eliminar(id: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/eliminar/${id}`, { responseType: 'text' }).pipe(
      tap(() => this.limpiarCache())
    );
  }

  /** Útil para llamarlo al cerrar sesión. */
  limpiarCache(): void {
    this.listarCache$ = undefined;
  }
}
