import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PisoService } from '../../core/services/piso.service';
import { Piso } from '../../core/models/piso'; // Importado directamente del core

@Component({
  selector: 'app-piso',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './piso.html',
  styleUrls: ['./piso.css']
})
export class PisoComponent implements OnInit {
  private readonly service = inject(PisoService);
  private readonly cdr = inject(ChangeDetectorRef);

  pisos: Piso[] = [];
  piso: Partial<Piso> = this.nuevoModelo();
  isProcessing = false;
  isLoading = false;

  // Hotel actual por defecto
  idHotelActual = 1;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading = true;
    this.service.listar().subscribe({
      next: (res) => {
        this.pisos = res.data || [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        Swal.fire('Error', 'No se pudieron cargar los pisos', 'error');
      }
    });
  }

  guardar(): void {
    this.isProcessing = true;

    // Construimos el payload asegurando los tipos requeridos por el backend
    const payload: Piso = {
      idPiso: this.piso.idPiso, // Puede ser undefined si es nuevo
      idHotel: this.piso.idHotel || this.idHotelActual,
      descripcion: this.piso.descripcion || '',
      estado: this.piso.estado ?? true
    };

    const operacion$ = payload.idPiso
      ? this.service.actualizar(payload.idPiso, payload)
      : this.service.registrar(payload);

    operacion$.subscribe({
      next: () => {
        Swal.fire('Éxito', 'Piso guardado correctamente', 'success');
        this.cargar();
        this.cerrarModal();
      },
      error: (err) => Swal.fire('Error', err.error?.message || 'Error al guardar', 'error'),
      complete: () => (this.isProcessing = false)
    });
  }

  eliminar(id?: number): void {
    if (!id) return;
    Swal.fire({
      title: '¿Estás seguro?',
      text: "El piso será eliminado",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.service.eliminar(id).subscribe(() => {
          this.cargar();
          Swal.fire('Eliminado', 'Piso eliminado correctamente', 'success');
        });
      }
    });
  }

  abrir(p?: Piso): void {
    this.piso = p ? { ...p } : this.nuevoModelo();
    const modalEl = document.getElementById('modalPiso');
    if (modalEl) (window as any).bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  cerrarModal(): void {
    const modalEl = document.getElementById('modalPiso');
    if (modalEl) (window as any).bootstrap.Modal.getInstance(modalEl)?.hide();
  }

  nuevoModelo(): Partial<Piso> {
    return {
      descripcion: '',
      estado: true,
      idHotel: this.idHotelActual
    };
  }
}
