import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { CarritoService } from '../../../../../../core/services/carritoservice';
import { VentaService } from '../../../../../../core/services/venta.service';
import { Carrito } from '../../../../../../core/models/Carrito';

@Component({
  selector: 'app-carrito-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carrito-detalle.html'
})
export class CarritoDetalle implements OnInit, OnDestroy {

  private readonly route = inject(ActivatedRoute);
  private readonly carritoService = inject(CarritoService);
  private readonly ventaService = inject(VentaService);
  private readonly cdr = inject(ChangeDetectorRef);

  carritoItems: Carrito[] = [];
  private carritoSub?: Subscription;

  idRecepcion = 0;
  isProcessing = false;

  ngOnInit(): void {

    // 🔥 SOLO TOMAMOS EL ID DE LA RUTA
    this.idRecepcion = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.idRecepcion || isNaN(this.idRecepcion)) {
      Swal.fire('Error', 'No se identificó la recepción.', 'error');
      return;
    }

    // 🔥 CARGAR CARRITO DIRECTO
    this.carritoService.actualizarCarrito(this.idRecepcion);

    this.carritoSub = this.carritoService.carrito$.subscribe(items => {
      this.carritoItems = items;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.carritoSub?.unsubscribe();
  }

  calcularTotal(): number {
    return this.carritoItems.reduce((acc, item) =>
      acc + (Number(item.precioUnitario || 0) * item.cantidad), 0
    );
  }

  eliminarDelCarrito(idProducto: number): void {
    this.carritoService.eliminarProducto(this.idRecepcion, idProducto)
      .subscribe({
        next: () => this.carritoService.actualizarCarrito(this.idRecepcion),
        error: (err) => {
          console.error(err);
          Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
        }
      });
  }

  procesarPedido(estado: 'PENDIENTE' | 'PAGADO'): void {

    if (this.carritoItems.length === 0) return;

    this.isProcessing = true;

    const ventaData = {
      idRecepcion: this.idRecepcion,
      estado: estado,
      detalles: JSON.stringify(
        this.carritoItems.map(item => ({
          idProducto: item.idProducto,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario
        }))
      )
    };

    this.ventaService.guardar(ventaData).subscribe({
      next: () => {
        this.isProcessing = false;
        this.carritoItems = [];
        this.cdr.markForCheck();

        Swal.fire('Éxito', `Pedido ${estado} registrado correctamente`, 'success');

        this.carritoService.actualizarCarrito(this.idRecepcion);
      },
      error: (err) => {
        this.isProcessing = false;

        Swal.fire('Error', err.error?.message || 'No se pudo procesar el pedido', 'error');
      }
    });
  }

  trackById(_: number, item: Carrito): number {
    return item.idProducto;
  }

  toNumber(value: any): number {
    return Number(value || 0);
  }
}
