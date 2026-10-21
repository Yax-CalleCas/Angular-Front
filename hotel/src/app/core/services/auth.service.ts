import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, RegistroClienteDto } from '../models/auth.models';
import { Persona } from '../models/persona.model';
import { Sede } from '../models/Sede/Sede';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // Rutas relativas: el proxy de Angular las reenvía al gateway (8089),
  // y el gateway las dirige a auth-service (8081)
  private readonly API_AUTH_URL = '/gateway/auth-service/api/auth';
  private readonly API_PERSONA_URL = '/gateway/auth-service/api/persona';

  private readonly TOKEN_KEY = 'token';
  private readonly ROLE_KEY = 'user_role';
  private readonly ID_KEY = 'user_id';
  private readonly SEDES_KEY = 'user_sedes';

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_AUTH_URL}/login`, credentials)
      .pipe(
        tap(response => {
          if (isPlatformBrowser(this.platformId) && response.token) {
            localStorage.setItem(this.TOKEN_KEY, response.token);
            localStorage.setItem(this.ROLE_KEY, response.tipoPersona);
            localStorage.setItem(this.ID_KEY, response.idPersona.toString());
            if (response.sedes) {
              localStorage.setItem(this.SEDES_KEY, JSON.stringify(response.sedes));
            }
          }
        })
      );
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.ROLE_KEY);
      localStorage.removeItem(this.ID_KEY);
      localStorage.removeItem(this.SEDES_KEY);
    }
  }

  registrarCliente(dto: RegistroClienteDto): Observable<Persona> {
    return this.http.post<Persona>(`${this.API_PERSONA_URL}/registro-publico`, dto);
  }

  getUserId(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.ID_KEY) : null;
  }

  getToken(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  getUserRole(): string | null {
    return isPlatformBrowser(this.platformId) ? localStorage.getItem(this.ROLE_KEY) : null;
  }

  getSedes(): Sede[] {
    if (isPlatformBrowser(this.platformId)) {
      const sedesJson = localStorage.getItem(this.SEDES_KEY);
      return sedesJson ? JSON.parse(sedesJson) : [];
    }
    return [];
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
