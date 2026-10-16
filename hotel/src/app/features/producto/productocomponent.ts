import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductoService } from '../../core/services/producto.service';
import { Producto } from '../../core/models/producto';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './producto.html',
  styleUrls: ['./productos.css']
})
export class ProductoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private prodService = inject(ProductoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  productos: Producto[] = [];
  form: FormGroup;
  isEdit = false;
  isLoading = false;
  isSaving = false;
  procesandoImagen = false;

  paginaActual = 1;
  readonly elementosPorPagina = 10;
  private readonly maxBytesOriginal = 5 * 1024 * 1024; // 5 MB
  private readonly maxLadoPx = 800;
  private readonly calidadJpeg = 0.8;

  constructor() {
    this.form = this.fb.group({
      idProducto: [null],
      nombre: ['', Validators.required],
      detalle: [''],
      precio: [0, [Validators.required, Validators.min(0)]],
      cantidad: [0, [Validators.required, Validators.min(0)]],
      estado: [true],
      imagenUrl: ['']
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  get mostrarFormulario(): boolean {
    return this.isEdit || this.form.dirty;
  }

  get productosPaginados(): Producto[] {
    const inicio = (this.paginaActual - 1) * this.elementosPorPagina;
    return this.productos.slice(inicio, inicio + this.elementosPorPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.productos.length / this.elementosPorPagina);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  cargar(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.prodService.listar()
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.productos = res.data ?? [];
          this.paginaActual = Math.min(this.paginaActual, Math.max(1, this.totalPaginas));
        },
        error: (err) => this.manejarError(err)
      });
  }

  async onArchivoSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire('Formato inválido', 'Por favor seleccione un archivo de imagen válido.', 'warning');
      return;
    }

    if (file.size > this.maxBytesOriginal) {
      Swal.fire('Archivo muy pesado', 'La imagen no debe superar los 5 MB.', 'warning');
      return;
    }

    // 1. Vista previa inmediata
    const readerPreview = new FileReader();
    readerPreview.onload = () => {
      this.form.patchValue({ imagenUrl: readerPreview.result as string });
      this.form.markAsDirty();
      this.cdr.detectChanges();
    };
    readerPreview.readAsDataURL(file);

    // 2. Compresión en segundo plano
    this.procesandoImagen = true;
    this.cdr.detectChanges();

    try {
      const imagenBase64Comprimida = await this.comprimirImagen(file);
      this.form.patchValue({ imagenUrl: imagenBase64Comprimida });
      this.form.markAsDirty();
    } catch {
      console.error('No se pudo comprimir la imagen, manteniendo la original.');
    } finally {
      this.procesandoImagen = false;
      this.cdr.detectChanges();
    }
  }

  private async comprimirImagen(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > this.maxLadoPx) {
              height = Math.round((height * this.maxLadoPx) / width);
              width = this.maxLadoPx;
            }
          } else {
            if (height > this.maxLadoPx) {
              width = Math.round((width * this.maxLadoPx) / height);
              height = this.maxLadoPx;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo obtener el contexto del canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', this.calidadJpeg));
        };
        img.onerror = (error) => reject(error);
        img.src = e.target.result;
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  removerImagen(): void {
    this.form.patchValue({ imagenUrl: '' });
    this.form.markAsDirty();
  }

  nuevo(): void {
    this.isEdit = false;
    this.form.reset({ precio: 0, cantidad: 0, estado: true, imagenUrl: '' });
    this.form.markAsDirty();
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) return;

    const formValue = this.form.value;

    // Asegurar que si está vacío, viaje como null
    const producto = {
      ...formValue,
      imagenUrl: formValue.imagenUrl && formValue.imagenUrl.trim() !== '' ? formValue.imagenUrl : null
    };

    const obs = this.isEdit
      ? this.prodService.actualizar(producto.idProducto, producto)
      : this.prodService.registrar(producto);

    this.isSaving = true;
    obs.subscribe({
      next: () => {
        this.finGuardado();
        Swal.fire('Éxito', 'Guardado correctamente', 'success');
        this.cancelar();
        this.cargar();
      },
      error: (err) => {
        this.finGuardado();
        this.manejarError(err);
      }
    });
  }

  editar(p: Producto): void {
    this.isEdit = true;
    this.form.patchValue(p);
    this.form.markAsPristine(); // Evita que se marque sucio automáticamente al abrir
  }

  eliminar(id: number | undefined): void {
    if (id === undefined || id === null) {
      Swal.fire('Error', 'No se puede eliminar un registro sin ID válido.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Eliminar?',
      text: 'Esta acción no se puede revertir',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((r) => {
      if (!r.isConfirmed) return;

      this.prodService.eliminar(id).subscribe({
        next: () => {
          Swal.fire('Eliminado', 'El producto ha sido removido.', 'success');
          this.cargar();
        },
        error: (err) => this.manejarError(err)
      });
    });
  }

  cancelar(): void {
    this.isEdit = false;
    this.form.reset({ precio: 0, cantidad: 0, estado: true, imagenUrl: '' });
  }

  private finGuardado(): void {
    this.isSaving = false;
    this.cdr.detectChanges();
  }

  private manejarError(err: any): void {
    console.error('Error en ProductoComponent:', err);

    if (err?.status === 403 || err?.status === 401) {
      Swal.fire('Sesión Caducada', 'No tienes permisos o tu sesión expiró.', 'error')
        .then(() => this.router.navigate(['/login']));
    } else {
      const mensaje = err?.error?.message || err?.error?.error || 'Ocurrió un error inesperado al procesar la solicitud.';
      Swal.fire('Error', mensaje, 'error');
    }
  }
}
