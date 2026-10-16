import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PisoService } from '../../core/services/piso.service';
import { Piso } from '../../core/models/piso';

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
  piso: Piso = this.nuevoModelo();
  isProcessing = false;
  isLoading = false;

  ngOnInit(): void {
    this.cargar();
  }
cargar(): void {
  this.isLoading = true; // Empieza a cargar
  this.service.listar().subscribe({
    next: (res) => {
      this.pisos = res.data || [];
      this.isLoading = false; // Termina
      this.cdr.detectChanges();
    },
    error: () => {
      this.isLoading = false;
      Swal.fire('Error', '...', 'error');
    }
  });
}

  guardar(): void {
    this.isProcessing = true;
    const operacion$ = this.piso.idPiso
      ? this.service.actualizar(this.piso.idPiso, this.piso)
      : this.service.registrar(this.piso);

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
    (window as any).bootstrap.Modal.getInstance(modalEl)?.hide();
  }

  nuevoModelo(): Piso {
    return { descripcion: '', estado: true };
  }
}
