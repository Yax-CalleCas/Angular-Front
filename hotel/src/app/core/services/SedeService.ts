import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Sede } from '../models/Sede/Sede';

@Injectable({
  providedIn: 'root'
})
export class SedeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/sede';

  listar(): Observable<Sede[]> {
    return this.http.get<Sede[]>(`${this.apiUrl}/listar`);
  }
}
