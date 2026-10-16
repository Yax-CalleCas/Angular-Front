import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { HabitacionService } from '../../core/services/habitacion.service';
import { PisoService } from '../../core/services/piso.service';
import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { Habitacion } from '../../core/models/Habitacion';

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.css']
})
export class RecepcionComponent implements OnInit {
  private readonly habService = inject(HabitacionService);
  private readonly router = inject(Router);
  private readonly pisoService = inject(PisoService);
  private readonly catService = inject(CategoriaService);
  private readonly estService = inject(EstadoHabitacionService);

  habitaciones = signal<Habitacion[]>([]);
  pisos = signal<any[]>([]);
  idPisoSeleccionado = signal<number>(0);
  isLoading = signal(false);

  private catsMap = new Map<number, string>();
  private estsMap = new Map<number, string>();

  habitacionesFiltradas = computed(() => {
    const pId = Number(this.idPisoSeleccionado());
    return pId === 0
      ? this.habitaciones()
      : this.habitaciones().filter(h => Number(h.idPiso) === pId);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);
    forkJoin({
      pisos: this.pisoService.listar(),
      habitaciones: this.habService.listar(),
      categorias: this.catService.listar(),
      estados: this.estService.listar()
    }).subscribe({
      next: ({ pisos, habitaciones, categorias, estados }) => {
        this.pisos.set(pisos.data ?? []);

        this.catsMap = new Map((categorias.data ?? []).map(c => [Number(c.idCategoria), c.descripcion]));
        this.estsMap = new Map((estados.data ?? []).map(e => [Number(e.idEstadoHabitacion), e.descripcion]));

        this.habitaciones.set(habitaciones.data ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos de recepción:', err);
        this.isLoading.set(false);
      }
    });
  }

  getCatNombre(id?: number): string {
    return id ? (this.catsMap.get(Number(id)) ?? 'N/A') : 'N/A';
  }

  getEstNombre(id?: number): string {
    return id ? (this.estsMap.get(Number(id)) ?? 'N/A') : 'N/A';
  }

  abrirDetalle(habitacion: Habitacion): void {
    const estadoNombre = this.getEstNombre(habitacion.idEstadoHabitacion).toLowerCase();

    if (estadoNombre.includes('libre') || estadoNombre.includes('disponible')) {
      this.router.navigate(['/admin/recepciondetalle', habitacion.idHabitacion]);
    } else {
      this.router.navigate(['/admin/recepciondetalle', habitacion.idHabitacion]);
    }
  }

  refrescarDatos(): void {
    this.habService.listar().subscribe({
      next: (res) => {
        this.habitaciones.set(res.data ?? []);
      },
      error: (err) => console.error('Error al refrescar habitaciones:', err)
    });
  }
}
