import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PersonaService } from '../../../../core/services/persona.service';
import { Persona } from '../../../../core/models/persona.model';

@Component({
  selector: 'app-cliente-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-list.html',
  styleUrls: ['./cliente-list.css']
})
export class ClienteListComponent implements OnInit {
  private readonly service = inject(PersonaService);

  personas: Persona[] = [];
  personaSeleccionada: Persona = this.crearPersonaVacia();
  terminoBusqueda = '';
  itemsPerPage = 7;
  currentPage = 1;
  guardando = false;

  ngOnInit(): void {
    this.cargarPersonas();
  }

  cargarPersonas(): void {
    this.service.listar().subscribe({
      next: (res: any) => {
        const lista = res?.data ?? res ?? [];
        this.personas = lista.filter((p: Persona) => Number(p.idTipoPersona) === 3);
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
          this.currentPage = this.totalPages;
        }
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudieron cargar los clientes';
        Swal.fire('Error', msg, 'error');
      }
    });
  }

  guardar(): void {
    if (this.guardando) return;
    this.guardando = true;

    const esEdicion = !!this.personaSeleccionada.idPersona;

    const payload: Persona = {
      ...this.personaSeleccionada,
      idTipoPersona: 3, // Forzamos siempre que sea tipo cliente
      clave: this.personaSeleccionada.clave || (esEdicion ? '**********' : ''),
      fotoUrl: this.personaSeleccionada.fotoUrl || '',
      sedes: (this.personaSeleccionada.sedes || []).map((s: any) => ({
        idSede: s.idSede,
        codigo: s.codigo,
        nombre: s.nombre
      }))
    };

    const obs = esEdicion
      ? this.service.actualizar(payload.idPersona!, payload)
      : this.service.crear(payload);

    obs.subscribe({
      next: () => {
        Swal.fire('Éxito', 'Operación realizada correctamente', 'success');
        this.cerrarModal();
        this.cargarPersonas();
      },
      error: (err) => {
        const msg = err.error?.message || 'Problema al procesar la solicitud';
        Swal.fire('Error', msg, 'error');
      },
      complete: () => (this.guardando = false)
    });
  }

  eliminar(id: number | undefined): void {
    if (!id) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará permanentemente al cliente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (res.isConfirmed) {
        this.service.eliminar(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Cliente eliminado con éxito', 'success');
            this.cargarPersonas();
          },
          error: (err) => Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  editarCliente(p: Persona): void {
    this.personaSeleccionada = { ...p, clave: '' };
    this.toggleModal('show');
  }

  nuevoCliente(): void {
    this.personaSeleccionada = this.crearPersonaVacia();
    this.toggleModal('show');
  }

  // --- Método para restringir el número de documento dinámicamente ---
  onDocumentoInput(event: any): void {
    const tipo = this.personaSeleccionada.tipoDocumento;
    let valor = event.target.value.replace(/\D/g, ''); // Solo permite números

    if (tipo === 'DNI') {
      if (valor.length > 8) {
        valor = valor.slice(0, 8); // Máximo 8 dígitos para DNI
      }
    } else {
      if (valor.length > 15) {
        valor = valor.slice(0, 15); // Máximo 15 para RUC u otros
      }
    }

    this.personaSeleccionada.documento = valor;
    event.target.value = valor; // Fuerza la vista del input a reflejar el corte
  }

  private toggleModal(action: 'show' | 'hide'): void {
    const el = document.getElementById('modalPersona');
    if (el) {
      const modal = (window as any).bootstrap?.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
      modal[action]();
    }
  }

  private cerrarModal = () => this.toggleModal('hide');

  private crearPersonaVacia(): Persona {
    return {
      tipoDocumento: 'DNI',
      documento: '',
      nombre: '',
      apellido: '',
      correo: '',
      clave: '',
      idTipoPersona: 3,
      estado: true,
      fotoUrl: '',
      sedes: []
    };
  }

  trackByPersona = (_: number, p: Persona) => p.idPersona;

  get filteredPersonas() {
    const busqueda = this.terminoBusqueda?.toLowerCase().trim() || '';
    return this.personas.filter(p =>
      (p.nombre?.toLowerCase().includes(busqueda)) ||
      (p.apellido?.toLowerCase().includes(busqueda)) ||
      (p.documento?.toLowerCase().includes(busqueda))
    );
  }

  get paginatedPersonas() {
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPersonas.slice(start, start + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredPersonas.length / this.itemsPerPage);
  }

  onImgError(event: any): void {
    event.target.src = 'https://goo.su/JYRdVM5';
  }

  cambiarEstado(p: Persona): void {
    const nuevoEstado = !p.estado;

    const personaActualizada: Persona = {
        ...p,
        estado: nuevoEstado,
        idTipoPersona: 3,
        clave: p.clave && p.clave.trim() !== '' ? p.clave : '**********',
        sedes: (p.sedes || []).map((s: any) => ({ idSede: s.idSede, codigo: s.codigo, nombre: s.nombre }))
    };

    this.service.actualizar(personaActualizada.idPersona!, personaActualizada).subscribe({
        next: () => {
            Swal.fire({
                icon: 'success',
                title: 'Estado actualizado',
                text: `El cliente ahora está ${nuevoEstado ? 'activo' : 'bloqueado'}.`,
                timer: 1500,
                showConfirmButton: false
            });
            this.cargarPersonas();
        },
        error: (err) => {
            console.error("Error completo del servidor:", err.error);
            Swal.fire('Error', err.error?.message || 'No se pudo cambiar el estado', 'error');
        }
    });
  }

  changePage(p: number) {
    if (p >= 1 && p <= this.totalPages) this.currentPage = p;
  }
}
