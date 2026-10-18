import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { HabitacionService } from '../../core/services/habitacion.service';
import { EstadoHabitacionService } from '../../core/services/EstadoHabitacionService';
import { CategoriaService } from '../../core/services/categoria.service';
import { PisoService } from '../../core/services/piso.service';

import { HabitacionRequestDTO, HabitacionResponseDTO } from '../../core/models/Habitacion';
import { EstadoHabitacionResponseDTO } from '../../core/models/estado-habitacion.model';
import { Categoria } from '../../core/models/categoria.model';
import { Piso } from '../../core/models/piso';

const ERRORES_HTTP: Record<number, { titulo: string; texto: string; icono: SweetAlertIcon }> = {
  409: {
    titulo: 'Operación en progreso',
    texto: 'La habitación tiene una operación en curso. Intenta nuevamente en unos minutos.',
    icono: 'warning'
  },
  412: {
    titulo: 'Conflicto de versión',
    texto: 'La información cambió en el servidor. Por favor recargue la página.',
    icono: 'error'
  }
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

  @ViewChild('modalHab') private modalElement!: ElementRef<HTMLElement>;

  readonly maxImagenes = 6;
  private readonly registrosPorPagina = 10;
  private readonly maxBytesOriginal = 10 * 1024 * 1024;
  private readonly maxLadoPx = 1280;
  private readonly calidadJpeg = 0.8;

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
      h.numero.toLowerCase().includes(filtro) ||
      h.categoria?.descripcion?.toLowerCase().includes(filtro)
    );
  });

  totalPaginas = computed(() =>
    Math.ceil(this.habitacionesFiltradas().length / this.registrosPorPagina)
  );

  paginas = computed(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => i + 1)
  );

  habitacionesPaginadas = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.registrosPorPagina;
    return this.habitacionesFiltradas().slice(inicio, inicio + this.registrosPorPagina);
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.isLoading.set(true);

    forkJoin({
      h: this.service.listar(),
      e: this.estadoService.listar(),
      c: this.categoriaService.listar(),
      p: this.pisoService.listar()
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ h, e, c, p }) => {
          this.estados.set(e.data || []);
          this.categorias.set(((c.data || []) as Categoria[]).filter(x => x.estado));
          this.pisos.set(((p.data || []) as Piso[]).filter(x => x.estado));

          this.habitaciones.set(
            (h.data || []).sort((a, b) => b.idHabitacion - a.idHabitacion)
          );

          this.paginaActual.update(pNum => Math.min(pNum, Math.max(1, this.totalPaginas())));
        },
        error: err => this.mostrarError(err, 'No se pudieron cargar los datos')
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
        urlsImagenes: h.imagenes?.map(img => img.urlImagen) || []
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
    this.isProcessing.set(true);
    const dto = this.habitacionForm();
    const idEdit = this.idHabitacionEditando();

    const peticion = idEdit
      ? this.service.actualizar(idEdit, dto)
      : this.service.guardar(dto);

    peticion
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: () => {
          this.cerrarModal();
          this.operacionExitosa('Operación realizada correctamente');
        },
        error: err => this.mostrarError(err, 'No se pudo guardar la información')
      });
  }

  eliminar(h: HabitacionResponseDTO): void {
    if (!h.idHabitacion) return;

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

      this.service.eliminar(h.idHabitacion).subscribe({
        next: () => this.operacionExitosa('Habitación dada de baja'),
        error: err => this.manejarErrorOperacion(
          err,
          'Solicitud de baja recibida en estado PREPARANDO.',
          'No se pudo dar de baja la habitación'
        )
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
      const validos = archivos
        .slice(0, cupo)
        .filter(f => f.type.startsWith('image/') && f.size <= this.maxBytesOriginal);
      const nuevas = await Promise.all(validos.map(f => this.comprimirImagen(f)));

      this.habitacionForm.update(form => ({
        ...form,
        urlsImagenes: [...(form.urlsImagenes ?? []), ...nuevas]
      }));

      if (validos.length < archivos.length) {
        Swal.fire('Algunas fotos se omitieron', 'Solo se aceptan imágenes de hasta 10 MB y dentro del límite permitido.', 'info');
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
    const estadoLower = descripcionEstado?.toLowerCase() || '';
    if (estadoLower.includes('disponible')) {
      return 'bg-[#E7F4EC] text-[#1D7A4F]';
    } else if (estadoLower.includes('ocupado')) {
      return 'bg-[#FCEBE9] text-[#B3261E]';
    } else if (estadoLower.includes('mantenimiento')) {
      return 'bg-[#FBF3E0] text-[#8F6400]';
    } else if (estadoLower.includes('limpieza')) {
      return 'bg-[#E8F0FA] text-[#2361A8]';
    }
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
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL('image/jpeg', this.calidadJpeg));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Imagen inválida'));
      };

      img.src = objectUrl;
    });
  }

  private get modal(): { show(): void; hide(): void } {
    return (window as any).bootstrap.Modal.getOrCreateInstance(this.modalElement.nativeElement);
  }

  private operacionExitosa(mensaje: string): void {
    Swal.fire('Éxito', mensaje, 'success');
    this.cargarDatos();
  }

  private manejarErrorOperacion(err: any, mensaje202: string, mensajePorDefecto: string): void {
    if (err?.status === 202) {
      Swal.fire('En Proceso', mensaje202, 'info');
      this.cargarDatos();
    } else {
      this.mostrarError(err, mensajePorDefecto);
    }
  }

  private mostrarError(err: any, mensajePorDefecto: string): void {
    const conocido = ERRORES_HTTP[err?.status];
    if (conocido) {
      Swal.fire(conocido.titulo, conocido.texto, conocido.icono);
      return;
    }
    const detalle = err?.error?.message ?? (typeof err?.error === 'string' ? err.error : null);
    Swal.fire('Error', detalle || mensajePorDefecto, 'error');
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
