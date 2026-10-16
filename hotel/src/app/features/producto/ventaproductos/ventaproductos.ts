import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { RecepcionService } from '../../../core/services/recepcion.service';
import { ProductoService } from '../../../core/services/producto.service';
import { VentaService } from '../../../core/services/venta.service';

// Interfaces para tipado fuerte
interface Producto {
  idProducto: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

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
  private cdr = inject(ChangeDetectorRef);

  // Tipado explícito en lugar de any
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
    this.recepcionService.buscarActivaPorHabitacion(idHabitacion).subscribe({
      next: (res: any) => {
        this.datosRecepcion = res?.data || res;
        this.cdr.detectChanges();
      }
    });

    this.productoService.listar().subscribe({
      next: (res: any) => {
        this.listaProductos = res?.data || [];
        this.cdr.detectChanges();
      }
    });
  }

  // Método explícito para el template
obtenerPrecioActual(): number {
  const prod = this.listaProductos.find(p => p.idProducto == this.productoSeleccionadoId);
  return prod ? prod.precio : 0;
}

  agregarAlCarrito(): void {
    if (this.productoSeleccionadoId === 0) return;

    const prod = this.listaProductos.find(p => p.idProducto == this.productoSeleccionadoId);
    if (!prod) return;

    const itemExistente = this.carrito.find(item => item.idProducto === prod.idProducto);

    if (itemExistente) {
      itemExistente.cantidad += this.cantidad;
      itemExistente.subTotal = itemExistente.cantidad * itemExistente.precio;
    } else {
      this.carrito.push({
        idProducto: prod.idProducto,
        nombre: prod.nombre,
        precio: prod.precio,
        cantidad: this.cantidad,
        subTotal: prod.precio * this.cantidad
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
    if (this.carrito.length === 0) {
      Swal.fire('Advertencia', 'El carrito está vacío.', 'warning');
      return;
    }

    this.isProcessing = true;

    // Estructura adaptada para el nuevo Backend (Function wrapper)
    const ventaData = {
      idRecepcion: this.datosRecepcion.idRecepcion,
      estado: this.estadoVenta,
      detalles: this.carrito.map(item => ({
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precio
      }))
    };

    this.ventaService.guardar(ventaData).subscribe({
      next: () => {
        this.isProcessing = false;
        Swal.fire('Éxito', `Venta registrada como ${this.estadoVenta}`, 'success')
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
