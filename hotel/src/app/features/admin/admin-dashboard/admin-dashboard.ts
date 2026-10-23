import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  EMPTY, Observable, catchError, filter, merge, share, shareReplay,
  switchMap, takeUntil, tap, timer
} from 'rxjs';
import { EstadisticasService } from '../../../core/services/EstadisticasService';
import { DashboardEstadisticas } from '../../../core/models/DashboardEstadisticas';

const INTERVALO_POLLING_MS = 5_000;

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin.css']
})
export class AdminDashboard {
  private readonly estadisticasService = inject(EstadisticasService);
  private readonly router = inject(Router);

  cargando = true;
  errorMensaje: string | null = null;

  readonly estadisticas$: Observable<DashboardEstadisticas> = this.crearStreamHibrido();

  private crearStreamHibrido(): Observable<DashboardEstadisticas> {
    // 1) Tiempo real: SSE, con polling REST si el stream se cae
    const stream$ = this.estadisticasService.estadisticas$.pipe(
      catchError((err) => {
        console.warn('SSE caído, cambiando a polling REST', err);
        return this.polling$();
      }),
      share()
    );

    // 2) Carga inicial instantánea por REST (se cancela si el SSE responde antes)
    const inicial$ = this.estadisticasService.obtenerSnapshot().pipe(
      catchError(() => EMPTY),
      takeUntil(stream$)
    );

    // 3) Unir ambos: lo primero que llegue se pinta, y el SSE sigue actualizando
    return merge(inicial$, stream$).pipe(
      filter((data): data is DashboardEstadisticas => !!data),
      tap(() => {
        this.cargando = false;
        this.errorMensaje = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private polling$(): Observable<DashboardEstadisticas> {
    return timer(0, INTERVALO_POLLING_MS).pipe(
      switchMap(() =>
        this.estadisticasService.obtenerSnapshot().pipe(
          catchError((err) => {
            console.error('Fallo en polling REST', err);
            this.cargando = false;
            this.errorMensaje = 'No se pudieron actualizar las estadísticas. Reintentando...';
            return EMPTY;
          })
        )
      )
    );
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
