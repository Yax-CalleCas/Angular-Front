import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';

import { RecepcionService } from '../../../core/services/recepcion.service';
import { VentaService } from '../../../core/services/venta.service';
import { PersonaService } from '../../../core/services/persona.service';
import { Venta } from '../../../core/models/Venta';
import { DetalleVenta } from '../../../core/models/detalleventa';
import { SalidaRequest, RecepcionResponseDTO } from '../../../core/models/recepcion.model';
import { Persona } from '../../../core/models/persona.model';

export interface ItemServicio {
  producto: string;
  cantidad: number;
  precioUnitario: number;
  estadoVenta: 'PAGADO' | 'PENDIENTE' | 'DEBE';
  subTotal: number;
}

@Component({
  selector: 'app-procesarsalida',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './procesarsalida.html'
})
export class Procesarsalida implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recService = inject(RecepcionService);
  private readonly ventaService = inject(VentaService);
  private readonly personaService = inject(PersonaService); // Inyectamos PersonaService como en RecepcionDetalle

  isLoading = signal(false);
  datosHospedaje = signal<RecepcionResponseDTO | null>(null);
  listaPersonas = signal<Persona[]>([]); // Almacena el listado de personas/clientes
  servicios = signal<ItemServicio[]>([]);
  costoPenalidad = signal<number>(0);

  // Computado para obtener los datos exactos del cliente vinculado a la recepción
  cliente = computed(() => {
    const h = this.datosHospedaje();
    if (!h || !h.idCliente) return null;
    return this.listaPersonas().find(p => p.idPersona === h.idCliente) || null;
  });

  totalConsumosPendientes = computed(() =>
    this.servicios().reduce((sum, s) =>
      s.estadoVenta !== 'PAGADO' ? sum + Number(s.subTotal || 0) : sum, 0
    )
  );

  totalNetoAPagar = computed(() => {
    const h = this.datosHospedaje();
    return Number(h?.precioRestante ?? 0) + Number(this.costoPenalidad()) + this.totalConsumosPendientes();
  });

  ngOnInit(): void {
    this.cargarClientes(); // Cargamos el catálogo de clientes al iniciar[cite: 11]
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.cargarDatos(id);
    } else {
      this.isLoading.set(false);
      Swal.fire('Error', 'ID de habitación o recepción no válido', 'error');
    }
  }

  private cargarClientes(): void {
    this.personaService.listar().subscribe({
      next: (personas: any) => {
        const lista = personas?.data ?? personas ?? [];
        this.listaPersonas.set(lista);
      },
      error: err => {
        console.error('Error al cargar la lista de personas:', err);
      }
    });
  }

  cargarDatos(idHabitacion: number): void {
    this.isLoading.set(true);
    this.recService.buscarActivaPorHabitacion(idHabitacion).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (data) {
          this.datosHospedaje.set(data);
          if (data.costoPenalidad) {
            this.costoPenalidad.set(Number(data.costoPenalidad));
          }
          this.cargarVentas(data.idRecepcion);
        } else {
          this.isLoading.set(false);
          Swal.fire('Error', 'No se encontró recepción activa para esta habitación', 'error');
        }
      },
      error: () => {
        this.isLoading.set(false);
        Swal.fire('Error', 'Error al cargar los datos del hospedaje', 'error');
      }
    });
  }

  private cargarVentas(idRecepcion: number): void {
    this.ventaService.buscarPorRecepcion(idRecepcion).subscribe({
      next: (res: any) => {
        const listaVentas: Venta[] = res?.data ?? res ?? [];

        const serviciosMapeados: ItemServicio[] = listaVentas.flatMap((venta: Venta) =>
          (venta.detalleVentas ?? []).map((d: DetalleVenta) => ({
            producto: d.nombreProducto ?? 'Producto sin nombre',
            cantidad: Number(d.cantidad || 0),
            precioUnitario: Number(d.precioUnitario || 0),
            estadoVenta: (venta.estado as 'PAGADO' | 'PENDIENTE' | 'DEBE'),
            subTotal: Number(d.subTotal || 0)
          }))
        );

        this.servicios.set(serviciosMapeados);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar consumos/ventas:', err);
        this.isLoading.set(false);
      }
    });
  }

  actualizarPenalidad(valor: unknown): void {
    const num = Number(valor);
    this.costoPenalidad.set(isNaN(num) ? 0 : num);
  }

  finalizarCheckOut(): void {
    const h = this.datosHospedaje();
    if (!h || !h.idRecepcion) {
      Swal.fire('Error', 'Datos de recepción no válidos', 'error');
      return;
    }

    Swal.fire({
      title: 'Confirmar Salida y Liberación (Check-out)',
      text: `Se procesará el cierre con un total neto de: S/ ${this.totalNetoAPagar().toFixed(2)}. La habitación pasará a mantenimiento/disponible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Finalizar Check-Out',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.isLoading.set(true);

        const payload: SalidaRequest = {
          idRecepcion: h.idRecepcion,
          costoPenalidad: this.costoPenalidad(),
          observacion: `Check-out procesado. Total neto cancelado: S/. ${this.totalNetoAPagar().toFixed(2)}`
        };

        this.recService.registrarSalida(payload).subscribe({
          next: () => {
            this.isLoading.set(false);
            Swal.fire('Éxito', 'Salida procesada y habitación liberada correctamente', 'success')
              .then(() => {
                this.router.navigate(['/admin/resumensalida', h.idRecepcion]);
              });
          },
          error: (err) => {
            this.isLoading.set(false);
            const mensaje = err.error?.message || err.message || 'Error al procesar la salida';
            Swal.fire('Error', mensaje, 'error');
          }
        });
      }
    });
  }
}
