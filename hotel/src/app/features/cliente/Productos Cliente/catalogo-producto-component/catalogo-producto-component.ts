import { Component, OnInit, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { ProductoService } from './../../../../core/services/producto.service';
import { CarritoService } from '../../../../core/services/carritoservice';
import { AuthService } from '../../../../core/services/auth.service';
import { Producto } from '../../../../core/models/producto';

@Component({
  selector: 'app-catalogo-producto-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo-producto-component.html',
  styleUrls: ['./catalogo-producto-component.css']
})
export class CatalogoProductoComponent implements OnInit, OnDestroy {

  private readonly productoService = inject(ProductoService);
  private readonly carritoService = inject(CarritoService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  private carritoSub?: Subscription;

  productos: Producto[] = [];
  productosAgregando = new Set<number>();
  cantidadCarrito = 0;

  private idPersona = 0;
  private idRecepcion = 0;

  ngOnInit(): void {

    const state = history.state;
    this.idRecepcion = Number(state?.idRecepcion);

    if (!Number.isFinite(this.idRecepcion) || this.idRecepcion <= 0) {
      Swal.fire('Error', 'Debes seleccionar una habitación primero.', 'error');
      this.router.navigate(['/cliente/habitacionesocupadasCliente']);
      return;
    }

    const rawId = this.authService.getUserId();
    const parsedId = Number(rawId);

    this.idPersona = Number.isFinite(parsedId) ? parsedId : 0;

    if (this.idPersona <= 0) {
      Swal.fire('Atención', 'Debes iniciar sesión para ver el catálogo.', 'warning');
      this.router.navigate(['/login']);
      return;
    }

    this.carritoSub = this.carritoService.carrito$.subscribe(items => {
      this.cantidadCarrito = items.reduce((sum, item) => sum + (item.cantidad ?? 0), 0);
      this.cdr.markForCheck();
    });

    this.cargarProductos();
    this.carritoService.actualizarCarrito(this.idRecepcion);
  }

  ngOnDestroy(): void {
    this.carritoSub?.unsubscribe();
  }

  cargarProductos(): void {
    this.productoService.listar().subscribe({
      next: (res: any) => {
        this.productos = res?.data ?? res ?? [];
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error al cargar productos:', err)
    });
  }

  agregarAlCarrito(producto: Producto): void {

    const idProducto = producto.idProducto;
    if (!idProducto) return;

    if (this.productosAgregando.has(idProducto)) return;

    this.productosAgregando.add(idProducto);

    this.carritoService.agregarAlCarrito(
      this.idRecepcion,
      idProducto,
      1
    ).subscribe({
      next: () => {

        this.productosAgregando.delete(idProducto);

        this.carritoService.actualizarCarrito(this.idRecepcion);

        Swal.fire('Éxito', 'Producto agregado al carrito', 'success');

        this.cdr.markForCheck();
      },
      error: (err) => {

        this.productosAgregando.delete(idProducto);

        const mensaje =
          err?.error?.message ||
          err?.error ||
          'No se pudo agregar al carrito';

        Swal.fire('Error', mensaje, 'error');

        this.cdr.markForCheck();
      }
    });
  }

irAlCarrito(): void {
  if (!this.idRecepcion) {
    Swal.fire('Error', 'No hay habitación seleccionada.', 'error');
    return;
  }

  this.router.navigate(['/cliente/carrito', this.idRecepcion]);
}

  trackById(_: number, item: Producto): number {
    return item.idProducto ?? 0;
  }
}
