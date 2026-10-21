import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RecepcionService } from '../../../../core/services/recepcion.service';
import { VentaService } from '../../../../core/services/venta.service';
import { PersonaService } from '../../../../core/services/persona.service';
import { Venta } from '../../../../core/models/Venta';
import { DetalleVenta } from '../../../../core/models/detalleventa';
import { RecepcionResponseDTO } from '../../../../core/models/recepcion.model';
import { Persona } from '../../../../core/models/persona.model';
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
  private readonly personaService = inject(PersonaService); // Inyectamos PersonaService

  // Estados reactivos con Signals
  datos = signal<RecepcionResponseDTO | null>(null);
  listaPersonas = signal<Persona[]>([]); // Almacena el listado de personas
  servicios = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  fechaSalidaCalculada: Date = new Date();

  // Computado para obtener los datos exactos del cliente vinculado
  cliente = computed(() => {
    const d = this.datos();
    if (!d || !d.idCliente) return null;
    return this.listaPersonas().find(p => p.idPersona === d.idCliente) || null;
  });

  ngOnInit(): void {
    this.cargarClientes(); // Cargamos el catálogo de clientes al iniciar
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.cargarDatosCompletos(id);
    } else {
      this.isLoading.set(false);
      Swal.fire('Error', 'ID de recepción no válido en el resumen', 'error');
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

  // Calcula el subtotal exacto de la lista de consumos / ventas pendientes o registrados
  calcularTotalConsumos(): number {
    return this.servicios().reduce((acc, curr) => acc + Number(curr.subTotal || 0), 0);
  }

  // Calcula el total final cumpliendo la regla de negocio exacta: Saldo Restante + Penalidad + Consumos
  calcularTotalFinal(): number {
    const d = this.datos();
    if (!d) return 0;

    const saldoHabitacion = Number(d.precioRestante ?? ((Number(d.totalPagado) || 0) - (Number(d.adelanto) || 0)));
    const penalidad = Number(d.costoPenalidad || 0);
    const consumos = this.calcularTotalConsumos();

    return Number((saldoHabitacion + penalidad + consumos).toFixed(2));
  }

  cargarDatosCompletos(idRecepcion: number): void {
    this.isLoading.set(true);

    this.recService.buscarPorId(idRecepcion).subscribe({
      next: (res: any) => {
        const d = res?.data ?? res;
        if (d) {
          this.datos.set(d);
          if (d?.fechaSalidaConfirmacion || d?.fechaSalida) {
            this.fechaSalidaCalculada = new Date(d.fechaSalidaConfirmacion || d.fechaSalida);
          }
          this.cargarConsumos(idRecepcion);
        } else {
          this.isLoading.set(false);
          Swal.fire('Atención', 'No se encontró información para esta recepción.', 'warning');
        }
      },
      error: (err) => {
        console.error("Error crítico al cargar resumen de recepción:", err);
        this.isLoading.set(false);
        Swal.fire({
          title: 'Error de Datos',
          text: 'No se pudo obtener el detalle de la recepción para el comprobante.',
          icon: 'error'
        });
      }
    });
  }

  private cargarConsumos(idRecepcion: number): void {
    this.ventaService.buscarPorRecepcion(idRecepcion).subscribe({
      next: (res: any) => {
        const listaVentas: Venta[] = res?.data ?? res ?? [];

        const todosLosDetalles = listaVentas.flatMap((v: Venta) =>
          (v.detalleVentas || []).map((det: DetalleVenta) => ({
            ...det,
            producto: det.nombreProducto || 'Producto de Inventario',
            subTotal: Number(det.subTotal || (Number(det.cantidad || 0) * Number(det.precioUnitario || 0)))
          }))
        );

        this.servicios.set(todosLosDetalles);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error("Error al cargar consumos de la venta:", err);
        this.isLoading.set(false);
      }
    });
  }

  imprimir(): void {
    window.print();
  }
}
