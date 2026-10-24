import {
  Component, OnInit, DestroyRef, inject, signal, computed, ViewChild, ElementRef, NgZone
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, TimeoutError, finalize, forkJoin, timeout } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { CategoriaService } from '../../core/services/categoria.service';
import { PisoService } from '../../core/services/piso.service';

import { HabitacionRequestDTO, HabitacionResponseDTO, EstadoHabitacionResponseDTO } from '../../core/models/Habitacion';
import { Categoria } from '../../core/models/categoria.model';
import { Piso } from '../../core/models/piso';

interface BootstrapModalInstance {
  show(): void;
  hide(): void;
}

interface BootstrapGlobal {
  Modal: {
    getOrCreateInstance(element: HTMLElement): BootstrapModalInstance;
  };
}

interface WindowWithBootstrap extends Window {
  bootstrap?: BootstrapGlobal;
}

const TIMEOUT_CARGA_MS = 30000;

const ERRORES_HTTP: Record<number, { titulo: string; texto: string; icono: SweetAlertIcon }> = {
  409: { titulo: 'Operación en progreso', texto: 'La habitación tiene una operación en curso. Intenta nuevamente.', icono: 'warning' },
  412: { titulo: 'Conflicto de versión', texto: 'La información cambió en el servidor. Recargue la página.', icono: 'error' }
};

@Component({
  selector: 'app-habitacion-list',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  templateUrl: './habitacion-list.html',
  styleUrls: ['./habitacion-list.css']
})
export class HabitacionListComponent implements OnInit {
  private readonly service = inject(HabitacionService);
  private readonly estadoService = inject(EstadoHabitacionService);
  private readonly categoriaService = inject(CategoriaService);
  private readonly pisoService = inject(PisoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  @ViewChild('modalHab') private modalElement!: ElementRef<HTMLElement>;

  readonly maxImagenes = 6;
  private readonly registrosPorPagina = 10;
  private readonly maxBytesOriginal = 10 * 1024 * 1024;
  private readonly maxLadoPx = 1280;
  private readonly calidadJpeg = 0.8;

  private cargaSub?: Subscription;

  habitaciones = signal<HabitacionResponseDTO[]>([]);
  habitacionForm = signal<HabitacionRequestDTO>(this.nuevoModeloRequest());
  idHabitacionEditando = signal<number | null>(null);

  categorias = signal<Categoria[]>([]);
  pisos = signal<Piso[]>([]);
  estados = signal<EstadoHabitacionResponseDTO[]>([]);

  filtroTexto = signal('');
  paginaActual = signal(1);
  isLoading = signal(false);
  isProcessing = signal(false);
  procesandoImagenes = signal(false);

  habitacionesFiltradas = computed(() => {
    const filtro = this.filtroTexto().toLowerCase().trim();
    return this.habitaciones().filter(h =>
      (h.numero ?? '').toLowerCase().includes(filtro) ||
      (h.categoria?.descripcion ?? '').toLowerCase().includes(filtro)
    );
  });

  totalPaginas = computed(() => Math.ceil(this.habitacionesFiltradas().length / this.registrosPorPagina));

  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));

  habitacionesPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.registrosPorPagina;
    return this.habitacionesFiltradas().slice(inicio, inicio + this.registrosPorPagina);
  });

  ngOnInit(): void {
    this.cargarDatos();
    this.iniciarSseTiempoReal();
  }

  cargarDatos(): void {
    // Cancela una carga anterior aún en curso (su finalize apaga el loader antes de reencenderlo).
    this.cargaSub?.unsubscribe();
    this.isLoading.set(true);

    this.cargaSub = forkJoin({
      h: this.service.listar(),
      e: this.estadoService.listar(),
      c: this.categoriaService.listar(),
      p: this.pisoService.listar()
    })
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef), // al salir de la pantalla se cancelan las peticiones
        finalize(() => this.isLoading.set(false)) // se apaga en éxito, error, timeout o cancelación
      )
      .subscribe({
        next: ({ h, e, c, p }) => {
          this.estados.set(e.data || []);
          this.categorias.set(((c.data || []) as Categoria[]).filter(x => x.estado));
          this.pisos.set(((p.data || []) as Piso[]).filter(x => x.estado));

          const activas = (h.data || []).filter(item => item.estado !== false);
          this.habitaciones.set(activas.sort((a, b) => b.idHabitacion - a.idHabitacion));
          this.paginaActual.update(pg => Math.min(pg, Math.max(1, this.totalPaginas())));
        },
        error: (err: unknown) => this.mostrarError(err, 'No se pudieron cargar los datos')
      });
  }

  private iniciarSseTiempoReal(): void {
    if (typeof window === 'undefined') return;

    this.service.obtenerCambiosTiempoReal()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (habitacionModificada) => {
          this.ngZone.run(() => {
            this.habitaciones.update(listaActual => {
              if (habitacionModificada.estado === false) {
                return listaActual.filter(h => h.idHabitacion !== habitacionModificada.idHabitacion);
              }

              const index = listaActual.findIndex(h => h.idHabitacion === habitacionModificada.idHabitacion);
              if (index !== -1) {
                const nuevaLista = [...listaActual];
                nuevaLista[index] = habitacionModificada;
                return nuevaLista;
              }
              return [habitacionModificada, ...listaActual];
            });
          });
        },
        error: (err: unknown) => console.error('Error en SSE:', err)
      });
  }

  abrir(h?: HabitacionResponseDTO): void {
    if (h) {
      this.idHabitacionEditando.set(h.idHabitacion);
      this.habitacionForm.set({
        idHotel: h.idHotel,
        numero: h.numero,
        detalle: h.detalle || '',
        precio: h.precio,
        idEstadoHabitacion: h.estadoHabitacion?.idEstadoHabitacion,
        idPiso: h.piso?.idPiso,
        idCategoria: h.categoria?.idCategoria,
        // Se descartan URLs vacías para no enviar imágenes en blanco al guardar.
        urlsImagenes: (h.imagenes ?? []).map(img => img.urlImagen || '').filter(url => url !== '')
      });
    } else {
      this.idHabitacionEditando.set(null);
      this.habitacionForm.set(this.nuevoModeloRequest());
    }
    this.modal.show();
  }

  cerrarModal(): void {
    this.modal.hide();
  }

  guardar(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);

    const dto = this.habitacionForm();
    const idEdit = this.idHabitacionEditando();

    const peticion = idEdit !== null
      ? this.service.actualizar(idEdit, dto)
      : this.service.guardar(dto);

    peticion
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: () => {
          this.cerrarModal();
          Swal.fire('Éxito', 'Operación realizada correctamente', 'success');
          this.cargarDatos();
        },
        error: (err: unknown) => this.mostrarError(err, 'No se pudo guardar la información')
      });
  }

  eliminar(h: HabitacionResponseDTO): void {
    const id = h.idHabitacion;
    if (!id) return;

    Swal.fire({
      title: '¿Confirmar baja?',
      text: `Esta acción dará de baja la habitación ${h.numero}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, dar de baja'
    }).then(res => {
      if (!res.isConfirmed) return;

      this.service.eliminar(id).subscribe({
        next: () => {
          Swal.fire('Eliminado', 'Habitación dada de baja correctamente', 'success');
          this.cargarDatos();
        },
        error: (err: unknown) => this.mostrarError(err, 'No se pudo dar de baja la habitación')
      });
    });
  }

  async onArchivosSeleccionados(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    input.value = '';
    if (!archivos.length) return;

    const actual = this.habitacionForm();
    const cupo = this.maxImagenes - (actual.urlsImagenes?.length ?? 0);
    if (cupo <= 0) {
      Swal.fire('Límite alcanzado', `Máximo ${this.maxImagenes} fotos por habitación.`, 'info');
      return;
    }

    this.procesandoImagenes.set(true);
    try {
      const validos = archivos.slice(0, cupo).filter(f => f.type.startsWith('image/') && f.size <= this.maxBytesOriginal);
      const descartados = archivos.length - validos.length;
      const nuevas = await Promise.all(validos.map(f => this.comprimirImagen(f)));

      this.habitacionForm.update(form => ({
        ...form,
        urlsImagenes: [...(form.urlsImagenes ?? []), ...nuevas]
      }));

      if (descartados > 0) {
        Swal.fire(
          'Archivos omitidos',
          `Se omitieron ${descartados} archivo(s): no eran imagen, superaban 10 MB o excedían el máximo de ${this.maxImagenes} fotos.`,
          'info'
        );
      }
    } catch {
      Swal.fire('Error', 'No se pudo procesar alguna de las imágenes.', 'error');
    } finally {
      this.procesandoImagenes.set(false);
    }
  }

  eliminarImagen(indice: number): void {
    this.habitacionForm.update(form => ({
      ...form,
      urlsImagenes: (form.urlsImagenes ?? []).filter((_, i) => i !== indice)
    }));
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas() || pagina === this.paginaActual()) return;
    this.paginaActual.set(pagina);
  }

  getEstadoBadgeClass(descripcionEstado?: string): string {
    const est = descripcionEstado?.toLowerCase() || '';
    if (est.includes('disponible')) return 'bg-[#E7F4EC] text-[#1D7A4F]';
    if (est.includes('ocupado')) return 'bg-[#FCEBE9] text-[#B3261E]';
    if (est.includes('mantenimiento')) return 'bg-[#FBF3E0] text-[#8F6400]';
    if (est.includes('limpieza')) return 'bg-[#E8F0FA] text-[#2361A8]';
    return 'bg-[#ECECEA] text-[#5B5B5B]';
  }

  private comprimirImagen(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const escala = Math.min(1, this.maxLadoPx / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * escala);
          canvas.height = Math.round(img.height * escala);
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas error')); return; }
          // Fondo blanco: sin esto, los PNG con transparencia quedan con fondo negro al pasar a JPEG.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', this.calidadJpeg));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Imagen inválida')); };
      img.src = objectUrl;
    });
  }

  private get modal(): BootstrapModalInstance {
    const win = window as unknown as WindowWithBootstrap;
    const modalModule = win.bootstrap?.Modal;
    if (!modalModule) throw new Error('Bootstrap Modal no disponible.');
    return modalModule.getOrCreateInstance(this.modalElement.nativeElement);
  }

  private mostrarError(err: unknown, msjDef: string): void {
    if (err instanceof TimeoutError) {
      Swal.fire('Tiempo agotado', 'El servidor tardó demasiado en responder. Intenta nuevamente.', 'warning');
      return;
    }

    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        Swal.fire('Sin conexión', 'No se pudo comunicar con el servidor.', 'error');
        return;
      }
      const conocido = ERRORES_HTTP[err.status];
      if (conocido) {
        Swal.fire(conocido.titulo, conocido.texto, conocido.icono);
        return;
      }
      const errorBody = err.error as { message?: string } | string | null;
      const detalle = typeof errorBody === 'object' && errorBody !== null
        ? errorBody.message
        : (typeof errorBody === 'string' ? errorBody : null);
      Swal.fire('Error', detalle || msjDef, 'error');
      return;
    }

    Swal.fire('Error', msjDef, 'error');
  }

  private nuevoModeloRequest(): HabitacionRequestDTO {
    return {
      idHotel: 1,
      numero: '',
      detalle: '',
      precio: 0,
      idEstadoHabitacion: 1,
      idPiso: 1,
      idCategoria: 1,
      urlsImagenes: []
    };
  }
}
