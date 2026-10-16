import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
import { ProductoClienteService } from '../../core/services/productocliente';
import { Producto } from '../../core/models/producto';

interface ItemCarrito {
  idProducto: number;
  nombre: string;
  precio: number;
  cantidad: number;
  subTotal: number;
}

@Component({
  selector: 'app-producto-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productocliente.html',
})
export class ProductoClienteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pedidoService = inject(ProductoClienteService);
  private readonly cdr = inject(ChangeDetectorRef);

  idRecepcion!: number;
  productos: Producto[] = [];
  carrito: ItemCarrito[] = [];
  isLoading = false;

  ngOnInit(): void {
    this.idRecepcion = Number(this.route.snapshot.paramMap.get('idRecepcion'));
    if (this.idRecepcion) {
      this.cargarProductos();
    } else {
      Swal.fire('Error', 'Acceso inválido. Enlace de recepción no detectado.', 'error');
    }
  }

  cargarProductos(): void {
    this.isLoading = true;
    this.pedidoService.obtenerCatalogo().subscribe({
      next: (res) => {
        // Filtrar solo productos activos si el backend no lo hace
        const lista = res.data || [];
        this.productos = lista.filter(p => p.estado !== false);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        Swal.fire('Error', 'No se pudo cargar el catálogo de productos.', 'error');
      }
    });
  }

  agregarAlCarrito(producto: Producto, cantidadInput: string): void {
    const cantidadSolicitada = Number(cantidadInput);
    const idProd = Number(producto.idProducto);
    const stockDisponible = Number(producto.cantidad || 0);
    const precioProd = Number(producto.precio || 0);

    if (cantidadSolicitada <= 0) {
      Swal.fire('Cantidad inválida', 'Por favor selecciona al menos 1 unidad.', 'warning');
      return;
    }

    if (cantidadSolicitada > stockDisponible) {
      Swal.fire('Stock insuficiente', `Solo quedan ${stockDisponible} unidades disponibles.`, 'warning');
      return;
    }

    const itemExistente = this.carrito.find(item => item.idProducto === idProd);

    if (itemExistente) {
      const nuevaCantidad = itemExistente.cantidad + cantidadSolicitada;
      if (nuevaCantidad > stockDisponible) {
        Swal.fire('Stock insuficiente', `No puedes agregar más unidades. Límite disponible: ${stockDisponible}`, 'warning');
        return;
      }
      itemExistente.cantidad = nuevaCantidad;
      itemExistente.subTotal = itemExistente.cantidad * itemExistente.precio;
    } else {
      this.carrito.push({
        idProducto: idProd,
        nombre: producto.nombre,
        precio: precioProd,
        cantidad: cantidadSolicitada,
        subTotal: cantidadSolicitada * precioProd
      });
    }

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `${producto.nombre} agregado`,
      showConfirmButton: false,
      timer: 1500
    });

    this.cdr.markForCheck();
  }

  removerDelCarrito(index: number): void {
    this.carrito.splice(index, 1);
    this.cdr.markForCheck();
  }

  get totalGeneral(): number {
    return this.carrito.reduce((sum, item) => sum + item.subTotal, 0);
  }

  procesarPedido(): void {
    if (this.carrito.length === 0) return;

    this.isLoading = true;

    const payloadVenta = {
      idRecepcion: this.idRecepcion,
      estado: 'DEBE',
      total: this.totalGeneral,
      detalles: this.carrito.map(item => ({
        idProducto: item.idProducto,
        cantidad: item.cantidad,
        precioUnitario: item.precio
      }))
    };

    this.pedidoService.enviarPedido(payloadVenta).subscribe({
      next: () => {
        Swal.fire('¡Pedido Solicitado!', 'Tu orden está en camino a tu habitación.', 'success');
        this.carrito = [];
        this.cargarProductos();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        Swal.fire('Error', 'No se pudo procesar tu solicitud.', 'error');
      }
    });
  }
}
