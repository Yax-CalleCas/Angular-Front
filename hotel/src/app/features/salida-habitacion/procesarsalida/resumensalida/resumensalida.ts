import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RecepcionService } from '../../../../core/services/recepcion.service';
import { VentaService } from '../../../../core/services/venta.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-resumensalida',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './resumensalida.html',
  styleUrls: ['./resumensalida.scss']
})
export class Resumensalida implements OnInit {
  dateNow = new Date();
  private readonly route = inject(ActivatedRoute);
  private readonly recService = inject(RecepcionService);
  private readonly ventaService = inject(VentaService);

  // Estados
  datos = signal<any | null>(null);
  servicios = signal<any[]>([]);
  isLoading = signal<boolean>(true);
fechaSalidaCalculada: Date = new Date();




  // En tu archivo resumensalida.ts, añade esto en el ngOnInit
ngOnInit(): void {
  const id = Number(this.route.snapshot.paramMap.get('id'));
  if (id) {
    // Agregamos un pequeño delay opcional si la base de datos es lenta,
    // pero idealmente con la atomicidad ya no hará falta.
    this.cargarDatosCompletos(id);
  } else {
    this.isLoading.set(false);
    Swal.fire('Error', 'ID de recepción no válido', 'error');
  }
}


// Calcula el subtotal de la lista de servicios
calcularTotalConsumos(): number {
  return this.servicios().reduce((acc, curr) => acc + (curr.subTotal || 0), 0);
}

// Calcula el total final: (Precio - Adelanto) + Penalidad + Consumos
calcularTotalFinal(): number {
  const d = this.datos();
  if (!d) return 0;

  const saldoHabitacion = (d.precioInicial || 0) - (d.adelanto || 0);
  const penalidad = (d.costoPenalidad || 0);
  const consumos = this.calcularTotalConsumos();

  return saldoHabitacion + penalidad + consumos;
}
cargarDatosCompletos(idRecepcion: number): void {
  this.isLoading.set(true);

  this.recService.buscarPorId(idRecepcion).subscribe({
    next: (res: any) => {
      const d = res.data ? res.data : res;
      this.datos.set(d);
      this.cargarConsumos(idRecepcion);
    },
    error: (err) => {
      console.error("Error crítico al cargar recepción:", err);
      // Aquí está el cambio:
      this.isLoading.set(false);
      Swal.fire({
        title: 'Error de Datos',
        text: 'La recepción parece estar en un estado inconsistente. Por favor, verifica el estado de la habitación.',
        icon: 'error'
      });
    }
  });
}
  private cargarConsumos(idRecepcion: number): void {
    this.ventaService.buscarPorRecepcion(idRecepcion).subscribe({
      next: (res: any) => {
        const listaVentas = res.data ?? [];
        const todosLosDetalles = listaVentas.flatMap((v: any) =>
          (v.detalles || []).map((det: any) => ({
            ...det,
            producto: det.nombreProducto || 'Producto'
          }))
        );
        this.servicios.set(todosLosDetalles);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error("Error al cargar ventas:", err);
        this.isLoading.set(false);
      }
    });
  }

  imprimir(): void {
    window.print();
  }
}
