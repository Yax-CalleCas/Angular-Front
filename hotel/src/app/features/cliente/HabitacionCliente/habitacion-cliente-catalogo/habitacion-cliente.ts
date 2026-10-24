import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../../../core/services/habitacion.service';
import { AuthService } from '../../../../core/services/auth.service';
import { HabitacionResponseDTO } from '../../../../core/models/Habitacion';

@Component({
  selector: 'app-habitacion-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './habitacion-cliente.html',
  styleUrls: ['./habitacion-cliente.scss']
})
export class HabitacionCliente implements OnInit {

  private readonly habitacionService = inject(HabitacionService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  habitaciones: HabitacionResponseDTO[] = [];
  cargando = false;

  ngOnInit(): void {
    // Verificación de sesión alineada usando AuthService
    const rawId = this.authService.getUserId();
    const parsedId = rawId ? Number(rawId) : NaN;

    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      Swal.fire('Atención', 'Debes iniciar sesión para ver las habitaciones.', 'warning');
      this.router.navigate(['/login']);
      return;
    }

    this.cargarHabitaciones();
  }

  cargarHabitaciones(): void {
    this.cargando = true;

    this.habitacionService.listar().subscribe({
      next: (response: any) => {
        const data = response?.data ?? response ?? [];

        // Filtramos solo las habitaciones disponibles (idEstadoHabitacion === 1)
        this.habitaciones = data.filter((h: any) => h.estadoHabitacion?.idEstadoHabitacion === 1);

        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al obtener habitaciones:', error);
        this.cargando = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'No se pudieron cargar las habitaciones disponibles.', 'error');
      }
    });
  }

  abrirDetalle(idHabitacion?: number): void {
    if (idHabitacion == null) {
      console.error('No se encontró el ID de la habitación.');
      return;
    }
    // Ruta correcta definida en tus rutas para el detalle del alquiler
    this.router.navigate(['/cliente/datalleAlquiler', idHabitacion]);
  }

  trackByHabitacion(index: number, item: HabitacionResponseDTO): number {
    return item.idHabitacion ?? index;
  }
}
