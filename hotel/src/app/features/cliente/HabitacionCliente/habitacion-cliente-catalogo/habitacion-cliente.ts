import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HabitacionService } from '../../../../core/services/habitacion.service';
import { Habitacion } from '../../../../core/models/Habitacion';

@Component({
  selector: 'app-habitacion-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './habitacion-cliente.html',
  styleUrls: ['./habitacion-cliente.scss']
})
export class HabitacionCliente implements OnInit {

  private habitacionService = inject(HabitacionService);
  private router = inject(Router);

  habitaciones: Habitacion[] = [];
  cargando = false;

  ngOnInit(): void {
    this.cargarHabitaciones();
  }

cargarHabitaciones(): void {
  this.cargando = true;

  this.habitacionService.listar().subscribe({
    next: (response: any) => {
      const data = response?.data ?? response ?? [];

      // Filtramos por idEstadoHabitacion === 1
      // Ajusta 'estadoHabitacion' si el objeto tiene una propiedad diferente
      this.habitaciones = data.filter((h: any) => h.idEstadoHabitacion === 1);

      this.cargando = false;
    },
    error: (error) => {
      console.error('Error al obtener habitaciones:', error);
      this.cargando = false;
    }
  });
}

  abrirDetalle(idHabitacion?: number): void {
    if (idHabitacion == null) {
      console.error('No se encontró el ID de la habitación.');
      return;
    }
    this.router.navigate(['/cliente/datalleAlquiler', idHabitacion]);
  }

  trackByHabitacion(index: number, item: Habitacion): number {
    return item.idHabitacion!;
  }
}
