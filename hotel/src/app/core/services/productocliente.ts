import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductoService } from '../../core/services/producto.service';
import { VentaService } from '../../core/services/venta.service';
import { ApiResponse } from '../../core/models/ApiResponse';
import { Producto } from '../../core/models/producto';
import { Venta } from '../../core/models/Venta';

@Injectable({
  providedIn: 'root'
})
export class ProductoClienteService {
  private readonly productoService = inject(ProductoService);
  private readonly ventaService = inject(VentaService);

  obtenerCatalogo(): Observable<ApiResponse<Producto[]>> {
    return this.productoService.listar();
  }

  enviarPedido(pedido: any): Observable<ApiResponse<Venta>> {
    return this.ventaService.guardar(pedido);
  }
}
