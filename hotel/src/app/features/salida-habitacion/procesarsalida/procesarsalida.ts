import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

import { RecepcionService } from '../../../core/services/recepcion.service';
import { VentaService } from '../../../core/services/venta.service';
import { Venta } from '../../../core/models/Venta';
import { DetalleVenta } from '../../../core/models/detalleventa';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './procesarsalida.html'
})
export class Procesarsalida implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recService = inject(RecepcionService);
  private readonly ventaService = inject(VentaService);

  isLoading = signal(false);
  datosHospedaje = signal<any | null>(null);
  servicios = signal<ItemServicio[]>([]);
  costoPenalidad = signal<number>(0);

  totalConsumosPendientes = computed(() =>
    this.servicios().reduce((sum, s) =>
      s.estadoVenta !== 'PAGADO' ? sum + s.subTotal : sum, 0
    )
  );

  totalNetoAPagar = computed(() => {
    const h = this.datosHospedaje();
    return Number(h?.precioRestante ?? 0) + Number(this.costoPenalidad()) + this.totalConsumosPendientes();
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargarDatos(id);
  }

  cargarDatos(idHabitacion: number): void {
    this.isLoading.set(true);
    this.recService.buscarActivaPorHabitacion(idHabitacion).subscribe({
      next: (res: any) => {
        if (res?.data) {
          this.datosHospedaje.set(res.data);
          this.cargarVentas(res.data.idRecepcion);
        } else {
          this.isLoading.set(false);
          Swal.fire('Error', 'No se encontró recepción activa', 'error');
        }
      },
      error: () => {
        this.isLoading.set(false);
        Swal.fire('Error', 'Error al cargar los datos', 'error');
      }
    });
  }

  private cargarVentas(idRecepcion: number): void {
    this.ventaService.buscarPorRecepcion(idRecepcion).subscribe({
      next: (res) => {
        const listaVentas: Venta[] = res?.data ?? [];

        const serviciosMapeados: ItemServicio[] = listaVentas.flatMap((venta: Venta) =>
          (venta.detalles ?? []).map((d: DetalleVenta) => ({

            producto: d.nombreProducto ?? 'Producto',
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            estadoVenta: (venta.estado as 'PAGADO' | 'PENDIENTE' | 'DEBE'),
            subTotal: d.subTotal
          }))
        );
        this.servicios.set(serviciosMapeados);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoading.set(false);
      }
    });
  }
finalizarCheckOut(): void {
  const h = this.datosHospedaje();
  if (!h || !h.idRecepcion) {
    Swal.fire('Error', 'Datos de recepción no válidos', 'error');
    return;
  }

  Swal.fire({
    title: 'Confirmar Salida',
    text: `Total a pagar: S/ ${this.totalNetoAPagar().toFixed(2)}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Registrar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      this.isLoading.set(true);

      this.recService.registrarSalida({
        idRecepcion: h.idRecepcion,
        idHabitacion: h.idHabitacion,
        costoPenalidad: this.costoPenalidad(),
        totalPagado: this.totalNetoAPagar()
      }).subscribe({
        next: () => {
          this.isLoading.set(false); // IMPORTANTE: detener el estado de carga
          Swal.fire('Éxito', 'Salida procesada correctamente', 'success')
            .then(() => {
              this.router.navigate(['/admin/resumensalida', h.idRecepcion]);
            });
        },
        error: (err) => {
          this.isLoading.set(false);
          // Mejoramos el manejo de error para mostrar el mensaje detallado del backend
          const mensaje = err.error?.message || err.message || 'Error al procesar salida';
          Swal.fire('Error', mensaje, 'error');
        }
      });
    }
  });

}
}
