import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RecepcionService } from '../../../core/services/recepcion.service';
import { ProductoService } from '../../../core/services/producto.service';
import { VentaService } from '../../../core/services/venta.service';
import { PersonaService } from '../../../core/services/persona.service'; // 💡 1. Importar tu PersonaService
import { Producto } from '../../../core/models/producto';

interface ItemCarrito {
  idProducto: number;
  nombre: string;
  precio: number;
  cantidad: number;
  subTotal: number;
}

@Component({
  selector: 'app-ventaproductos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventaproductos.html'
})
export class Ventaproductos implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private recepcionService = inject(RecepcionService);
  private productoService = inject(ProductoService);
  private ventaService = inject(VentaService);
  private personaService = inject(PersonaService); // 💡 2. Inyectar el servicio
  private cdr = inject(ChangeDetectorRef);

  datosRecepcion: any = null;
  listaProductos: Producto[] = [];
  carrito: ItemCarrito[] = [];

  productoSeleccionadoId: number = 0;
  cantidad: number = 1;
  isProcessing: boolean = false;
  estadoVenta: 'PENDIENTE' | 'PAGADO' = 'PENDIENTE';

  ngOnInit(): void {
    const idHab = this.route.snapshot.paramMap.get('id');
    if (idHab) this.cargarTodo(Number(idHab));
  }

  cargarTodo(idHabitacion: number): void {
    // 1. Obtener la recepción activa de la habitación
    this.recepcionService.buscarActivaPorHabitacion(idHabitacion).subscribe({
      next: (res: any) => {
        const recep = res?.data || res;
        if (!recep) return;

        // Datos iniciales de la recepción
        this.datosRecepcion = {
          idRecepcion: recep.idRecepcion,
          numero: recep.numeroHabitacion || `Hab. ${idHabitacion}`,
          detalle: recep.observacion || 'WIFI + BAÑO + TV + CABLE',
          categoriaNombre: 'Matrimonial',
          nombre: 'Cargando cliente...',
          apellido: ''
        };
        this.cdr.detectChanges();

        // 💡 2. Consultar al PersonaService usando el idCliente de la recepción
        if (recep.idCliente) {
          this.personaService.obtenerPorId(recep.idCliente).subscribe({
            next: (persona: any) => {
              const cli = persona?.data || persona;
              if (cli) {
                this.datosRecepcion.nombre = cli.nombre || 'Cliente';
                this.datosRecepcion.apellido = cli.apellido || '';
                this.cdr.detectChanges();
              }
            },
            error: (err) => {
              console.error('Error al obtener los datos de la persona:', err);
              this.datosRecepcion.nombre = 'Cliente No Encontrado';
              this.cdr.detectChanges();
            }
          });
        } else {
          this.datosRecepcion.nombre = 'Sin Cliente Asignado';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error al obtener la recepción activa:', err);
        Swal.fire('Atención', 'No se encontró una recepción activa para esta habitación.', 'warning');
      }
    });

    // 3. Cargar productos disponibles
    this.productoService.listar().subscribe({
      next: (res: any) => {
        const productosRaw = res?.data || res || [];
        this.listaProductos = productosRaw.filter((p: Producto) => p.estado !== false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener productos:', err);
      }
    });
  }

  obtenerPrecioActual(): number {
    const prod = this.listaProductos.find(p => Number(p.idProducto) === Number(this.productoSeleccionadoId));
    return prod ? (prod.precio || 0) : 0;
  }

  agregarAlCarrito(): void {
    if (!this.productoSeleccionadoId || this.productoSeleccionadoId === 0) {
      Swal.fire('Advertencia', 'Seleccione un producto.', 'warning');
      return;
    }

    const prod = this.listaProductos.find(p => Number(p.idProducto) === Number(this.productoSeleccionadoId));
    if (!prod || prod.idProducto === undefined) return;

    const stockDisponible = prod.cantidad || 0;
    const itemExistente = this.carrito.find(item => item.idProducto === prod.idProducto);
    const cantidadActualEnCarrito = itemExistente ? itemExistente.cantidad : 0;
    const nuevaCantidadTotal = cantidadActualEnCarrito + this.cantidad;

    if (nuevaCantidadTotal > stockDisponible) {
      Swal.fire('Stock Insuficiente', `Stock disponible: ${stockDisponible} unidades.`, 'warning');
      return;
    }

    if (this.cantidad <= 0) {
      Swal.fire('Advertencia', 'La cantidad debe ser al menos 1.', 'warning');
      return;
    }

    const precioProd = prod.precio || 0;

    if (itemExistente) {
      itemExistente.cantidad = nuevaCantidadTotal;
      itemExistente.subTotal = itemExistente.cantidad * itemExistente.precio;
    } else {
      this.carrito.push({
        idProducto: prod.idProducto,
        nombre: prod.nombre,
        precio: precioProd,
        cantidad: this.cantidad,
        subTotal: precioProd * this.cantidad
      });
    }

    this.productoSeleccionadoId = 0;
    this.cantidad = 1;
    this.cdr.detectChanges();
  }

  getTotal(): number {
    return this.carrito.reduce((acc, item) => acc + item.subTotal, 0);
  }

  registrarVenta(): void {
    if (!this.datosRecepcion || !this.datosRecepcion.idRecepcion) {
      Swal.fire('Error', 'No se encontró la recepción activa.', 'error');
      return;
    }

    if (this.carrito.length === 0) {
      Swal.fire('Advertencia', 'El carrito está vacío.', 'warning');
      return;
    }

    this.isProcessing = true;

    const ventaData = {
      idRecepcion: Number(this.datosRecepcion.idRecepcion),
      estado: this.estadoVenta,
      detalleVentas: this.carrito.map(item => ({
        idProducto: Number(item.idProducto),
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precio)
      }))
    };

    this.ventaService.guardar(ventaData as any).subscribe({
      next: () => {
        this.isProcessing = false;
        Swal.fire('Éxito', `Venta registrada correctamente como ${this.estadoVenta}`, 'success')
          .then(() => this.router.navigate(['/admin/recepcion']));
      },
      error: (err) => {
        this.isProcessing = false;
        const msg = err.error?.message || 'Error al procesar la venta.';
        Swal.fire('Error', msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
