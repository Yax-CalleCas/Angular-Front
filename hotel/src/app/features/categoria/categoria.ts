import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { CategoriaService } from '../../core/services/categoria.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { Categoria } from '../../core/models/categoria.model';
import { EstadoHabitacionResponseDTO } from '../../core/models/estado-habitacion.model';

@Component({
  selector: 'app-categoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categoria.html',
  styleUrls: ['./categoria.css']
})
export class CategoriaComponent implements OnInit {
  private readonly service = inject(CategoriaService);
  private readonly estadoService = inject(EstadoHabitacionService);
  private readonly cdr = inject(ChangeDetectorRef);

  // --- CATEGORÍAS ---
  categorias: Categoria[] = [];
  categoria: Categoria = this.nuevoModeloCategoria();
  isProcessingCategoria = false;

  // --- ESTADOS DE HABITACIÓN ---
  estados: EstadoHabitacionResponseDTO[] = [];
  estadoHabitacion: EstadoHabitacionResponseDTO = this.nuevoModeloEstado();
  isProcessingEstado = false;

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarEstados();
  }

  // ================= CATEGORÍAS =================
  cargarCategorias(): void {
    this.service.listar().subscribe({
      next: (res) => {
        this.categorias = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err) =>
        Swal.fire('Error', err.error?.message || 'No se pudieron cargar las categorías', 'error')
    });
  }

  guardarCategoria(): void {
    this.isProcessingCategoria = true;

    const id = this.categoria.idCategoria;
    const { idCategoria, ...sinId } = this.categoria;

    const operacion$ = id
      ? this.service.actualizar(id, this.categoria)
      : this.service.registrar(sinId as Categoria);

    operacion$
      .pipe(finalize(() => {
        this.isProcessingCategoria = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          Swal.fire('Éxito', 'Categoría guardada correctamente', 'success');
          this.cargarCategorias();
          this.cerrarModalCategoria();
        },
        error: (err) =>
          Swal.fire('Error', err.error?.message || 'Error al guardar', 'error')
      });
  }

  eliminarCategoria(id?: number): void {
    if (!id) return;
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'La categoría será desactivada',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.eliminar(id).subscribe({
          next: () => {
            this.cargarCategorias();
            Swal.fire('Eliminado', 'Categoría dada de baja', 'success');
          },
          error: (err) =>
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  nuevoModeloCategoria(): Categoria {
    return { idCategoria: 0, descripcion: '', estado: true };
  }

  abrirCategoria(c?: Categoria): void {
    this.categoria = c ? { ...c } : this.nuevoModeloCategoria();
    const modalEl = document.getElementById('modalCat');
    if (modalEl) (window as any).bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  cerrarModalCategoria(): void {
    const modalEl = document.getElementById('modalCat');
    if (modalEl) (window as any).bootstrap.Modal.getInstance(modalEl)?.hide();
  }

  // ================= ESTADOS DE HABITACIÓN =================
  cargarEstados(): void {
    this.estadoService.listar().subscribe({
      next: (res) => {
        this.estados = res.data || [];
        this.cdr.detectChanges();
      },
      error: (err) =>
        Swal.fire('Error', err.error?.message || 'No se pudieron cargar los estados', 'error')
    });
  }

  guardarEstado(): void {
    this.isProcessingEstado = true;

    const id = this.estadoHabitacion.idEstadoHabitacion;
    const { idEstadoHabitacion, ...sinId } = this.estadoHabitacion;

    const operacion$ = id
      ? this.estadoService.actualizar(id, this.estadoHabitacion)
      : this.estadoService.registrar(sinId as EstadoHabitacionResponseDTO);

    operacion$
      .pipe(finalize(() => {
        this.isProcessingEstado = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          Swal.fire('Éxito', 'Estado de habitación guardado correctamente', 'success');
          this.cargarEstados();
          this.cerrarModalEstado();
        },
        error: (err) =>
          Swal.fire('Error', err.error?.message || 'Error al guardar estado', 'error')
      });
  }

  eliminarEstado(id?: number): void {
    if (!id) return;
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'El estado de habitación será dado de baja',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.estadoService.eliminar(id).subscribe({
          next: () => {
            this.cargarEstados();
            Swal.fire('Eliminado', 'Estado dado de baja', 'success');
          },
          error: (err) =>
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  // 🔹 Se añadió la propiedad 'codigo' obligatoria que exige EstadoHabitacionResponseDTO
  nuevoModeloEstado(): EstadoHabitacionResponseDTO {
    return { idEstadoHabitacion: 0, codigo: '', descripcion: '', estado: true };
  }

  abrirEstado(e?: EstadoHabitacionResponseDTO): void {
    this.estadoHabitacion = e ? { ...e } : this.nuevoModeloEstado();
    const modalEl = document.getElementById('modalEstado');
    if (modalEl) (window as any).bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  cerrarModalEstado(): void {
    const modalEl = document.getElementById('modalEstado');
    if (modalEl) (window as any).bootstrap.Modal.getInstance(modalEl)?.hide();
  }
}
