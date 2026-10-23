import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PersonaService } from '../../../../core/services/persona.service';
import { SedeService } from '../../../../core/services/SedeService';
import { Persona } from '../../../../core/models/persona.model';
import { Sede } from '../../../../core/models/Sede/Sede';

const ROLES: Record<number, { nombre: string }> = {
  1: { nombre: 'Administrador' },
  2: { nombre: 'Empleado' },
  3: { nombre: 'Cliente' }
};

const COLOR_PRIMARIO = '#8A1E33';

@Component({
  selector: 'app-persona-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './persona-list.html',
  styleUrls: ['./persona-list.css']
})
export class PersonaListComponent implements OnInit {
  private readonly service = inject(PersonaService);
  private readonly sedeService = inject(SedeService);

  personas = signal<Persona[]>([]);
  sedesDisponibles = signal<Sede[]>([]);
  personaSeleccionada = signal<Persona>(this.crearPersonaVacia());
  isProcessing = signal(false);
  currentPage = signal(1);
  itemsPerPage = 10;

  roles = Object.entries(ROLES).map(([id, val]) => ({ id: Number(id), ...val }));

  paginatedPersonas = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    return this.personas().slice(start, start + this.itemsPerPage);
  });

  totalPaginas = computed(() => Math.ceil(this.personas().length / this.itemsPerPage));

  ngOnInit(): void {
    this.cargarPersonas();
    this.cargarSedes();
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas()) {
      this.currentPage.set(pagina);
    }
  }

  cargarPersonas(): void {
    this.service.listar().subscribe({
      next: (res: any) => {
        // Adaptado para manejar ApiResponse del backend (res.data o res directo)
        const lista = res?.data ?? res ?? [];
        this.personas.set(lista);
        if (this.currentPage() > this.totalPaginas() && this.totalPaginas() > 0) {
          this.currentPage.set(this.totalPaginas());
        }
      },
      error: () => Swal.fire({
        title: 'Error',
        text: 'No se pudieron cargar los datos',
        icon: 'error',
        confirmButtonColor: COLOR_PRIMARIO
      })
    });
  }

  cargarSedes(): void {
    this.sedeService.listar().subscribe({
      next: (res: any) => {
        const lista = res?.data ?? res ?? [];
        this.sedesDisponibles.set(lista);
      },
      error: (err) => {
        console.error('Error al cargar sedes:', err);
      }
    });
  }

  isSedeSeleccionada(idSede?: number): boolean {
    const sedesActuales = this.personaSeleccionada().sedes || [];
    return sedesActuales.some(s => s.idSede === idSede);
  }

  onSedeChange(sede: Sede, event: any): void {
    const checked = event.target.checked;
    this.personaSeleccionada.update(p => {
      let sedes = p.sedes ? [...p.sedes] : [];
      if (checked) {
        if (!sedes.some(s => s.idSede === sede.idSede)) {
          sedes.push(sede);
        }
      } else {
        sedes = sedes.filter(s => s.idSede !== sede.idSede);
      }
      return { ...p, sedes };
    });
  }

  guardar(): void {
    if (this.isProcessing()) return;

    const data = this.personaSeleccionada();
    this.isProcessing.set(true);

    const esEdicion = !!data.idPersona;

    // Mapeo limpio asegurando que 'sedes' envíe los objetos requeridos por SedeDto
    const payload: Persona = {
      ...data,
      idTipoPersona: Number(data.idTipoPersona),
      clave: data.clave || (esEdicion ? '**********' : ''),
      fotoUrl: data.fotoUrl || '',
      sedes: (data.sedes || []).map(s => ({ idSede: s.idSede, codigo: s.codigo, nombre: s.nombre }))
    };

    const operacion = esEdicion
      ? this.service.actualizar(data.idPersona!, payload)
      : this.service.crear(payload);

    operacion.subscribe({
      next: () => {
        this.cerrarModal();
        this.limpiarFormulario();
        this.cargarPersonas();
        Swal.fire({
          title: 'Éxito',
          text: esEdicion ? 'Persona actualizada correctamente' : 'Persona registrada correctamente',
          icon: 'success',
          confirmButtonColor: COLOR_PRIMARIO
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Error',
          text: err?.error?.message || 'Error de validación',
          icon: 'error',
          confirmButtonColor: COLOR_PRIMARIO
        });
      },
      complete: () => this.isProcessing.set(false)
    });
  }

  // Agrega este método en tu clase PersonaListComponent
onDocumentoInput(event: any): void {
  const tipo = this.personaSeleccionada().tipoDocumento;
  let valor = event.target.value.replace(/\D/g, ''); // Solo permite números

  if (tipo === 'DNI') {
    if (valor.length > 8) {
      valor = valor.slice(0, 8); // Corta a 8 dígitos máximo si es DNI
    }
  } else {
    if (valor.length > 15) {
      valor = valor.slice(0, 15); // Máximo 15 para otros documentos
    }
  }

  // Actualiza el Signal con el valor limpio y limitado
  this.personaSeleccionada.update(p => ({ ...p, documento: valor }));
}

  cambiarEstado(p: Persona): void {
    const payload: Persona = {
      ...p,
      estado: !p.estado,
      idTipoPersona: Number(p.idTipoPersona),
      clave: p.clave && p.clave.trim() !== '' ? p.clave : '**********',
      sedes: (p.sedes || []).map(s => ({ idSede: s.idSede, codigo: s.codigo, nombre: s.nombre }))
    };

    this.service.actualizar(p.idPersona!, payload).subscribe({
      next: () => this.cargarPersonas(),
      error: (err) => {
        console.error('Detalle del error:', err.error);
        Swal.fire({
          title: 'Error',
          text: 'No se pudo cambiar el estado',
          icon: 'error',
          confirmButtonColor: COLOR_PRIMARIO
        });
      }
    });
  }

  eliminar(id: number | undefined): void {
    if (!id) return;
  }

  editar(persona: Persona): void {
    this.personaSeleccionada.set({ ...persona, clave: '' });
  }

  limpiarFormulario(): void {
    this.personaSeleccionada.set(this.crearPersonaVacia());
  }

  private cerrarModal(): void {
    const btn = document.querySelector<HTMLElement>('#modalPersona [data-bs-dismiss="modal"]');
    btn?.click();
  }

  onImgError(event: any): void {
    event.target.src = 'https://goo.su/V78kA';
  }

  getRolInfo(id: number) {
    return ROLES[id] || { nombre: 'Desconocido' };
  }

  trackByPersona = (_: number, p: Persona) => p.idPersona;

  private crearPersonaVacia(): Persona {
    return {
      tipoDocumento: 'DNI', // Valor por defecto sensato
      documento: '',
      nombre: '',
      apellido: '',
      correo: '',
      clave: '',
      idTipoPersona: 0,
      estado: true,
      fotoUrl: '',
      sedes: []
    };
  }
}
