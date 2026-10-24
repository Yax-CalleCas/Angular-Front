import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReporteService } from '../../../core/services/ReporteService';
import { ExportService } from '../../../core/services/ExportService';
import {
  ReporteVentaDto,
  ProductoDto,
  RecepcionResponseDTO
} from '../../../core/models/reporte.models';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  private readonly service = inject(ReporteService);
  private readonly exportService = inject(ExportService);

  // Selector de tipo de reporte activo
  tipoReporte = signal<'ventas' | 'stockBajo' | 'alquileres' | 'cuentasPorCobrar' | 'penalidades'>('ventas');

  resultados = signal<any[]>([]);
  resumenPenalidadesData = signal<any>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Cálculo de totales generales dinámicos según el reporte activo
  totalGeneral = computed<number>(() => {
    const data = this.resultados();
    const type = this.tipoReporte();

    if (type === 'ventas') {
      return (data as any[]).reduce((acc, curr) => acc + (curr.ingresoGenerado || 0), 0);
    }
    if (type === 'alquileres') {
      return (data as any[]).reduce((acc, curr) => acc + (curr.precioInicial || curr.totalPagado || curr.costoTotal || 0), 0);
    }
    if (type === 'cuentasPorCobrar') {
      return (data as any[]).reduce((acc, curr) => acc + (curr.precioRestante || curr.saldo || 0), 0);
    }
    return 0;
  });

  constructor() {
    // Sincronización en tiempo real vía SSE conectada al backend
    this.service.streamReportesRecepcion()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          const tipo = this.tipoReporte();
          if (tipo === 'alquileres' || tipo === 'cuentasPorCobrar' || tipo === 'penalidades') {
            this.generarReporteSilencioso();
          }
        },
        error: (err) => console.error('Error en SSE de reportes de recepción:', err)
      });
  }

  ngOnInit(): void {
    this.generarReporte();
  }

  generarReporte(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resumenPenalidadesData.set(null);

    this.ejecutarObservableReporte().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (data) => this.procesarRespuestaReporte(data),
      error: (err) => {
        console.error('Error al generar reporte:', err);
        this.errorMessage.set('Error al conectar con el servidor de reportes.');
        this.resultados.set([]);
      }
    });
  }

  private generarReporteSilencioso(): void {
    this.ejecutarObservableReporte().subscribe({
      next: (data) => this.procesarRespuestaReporte(data),
      error: (err) => console.error('Error al actualizar reporte en segundo plano:', err)
    });
  }

  private ejecutarObservableReporte(): Observable<any> {
    const tipo = this.tipoReporte();
    switch (tipo) {
      case 'ventas':
        return this.service.getProductosMasVendidos();
      case 'stockBajo':
        return this.service.getStockBajo(5);
      case 'alquileres':
        return this.service.getAlquileres();
      case 'cuentasPorCobrar':
        return this.service.getCuentasPorCobrar();
      case 'penalidades':
        return this.service.getResumenPenalidades();
      default:
        return this.service.getProductosMasVendidos();
    }
  }

  private procesarRespuestaReporte(data: any): void {
    const tipo = this.tipoReporte();
    if (tipo === 'penalidades') {
      this.resumenPenalidadesData.set(data);
      this.resultados.set([]);
    } else {
      this.resultados.set(data || []);
    }
  }

  cambiarTipo(tipo: 'ventas' | 'stockBajo' | 'alquileres' | 'cuentasPorCobrar' | 'penalidades'): void {
    this.tipoReporte.set(tipo);
    this.generarReporte();
  }

  // ==========================================
  // FUNCIONES DE EXPORTACIÓN (PDF y EXCEL)
  // ==========================================

  exportarPDF(): void {
    const data = this.resultados();
    const tipo = this.tipoReporte();

    if ((!data || data.length === 0) && tipo !== 'penalidades') {
      return;
    }

    let titulo = '';
    let fileName = '';
    let columnas: string[] = [];
    let datosFormateados: any[] = [];

    switch (tipo) {
      case 'ventas':
        titulo = 'Reporte de Productos Más Vendidos';
        fileName = 'reporte_ventas';
        columnas = ['ID Producto', 'Nombre del Producto', 'Cantidad Vendida', 'Ingreso Generado'];
        datosFormateados = data.map(item => ({
          id: item.idProducto ?? '',
          nombre: item.nombreProducto ?? '',
          cantidad: `${item.cantidadVendida ?? 0} unids.`,
          ingreso: `S/. ${(item.ingresoGenerado || 0).toFixed(2)}`
        }));
        break;

      case 'stockBajo':
        titulo = 'Reporte de Stock Bajo';
        fileName = 'reporte_stock_bajo';
        columnas = ['ID Producto', 'Producto', 'Detalle', 'Stock Actual', 'Precio Unitario'];
        datosFormateados = data.map(item => ({
          id: item.idProducto ?? '',
          nombre: item.nombre ?? '',
          detalle: item.detalle ?? 'Sin detalles',
          stock: `${item.cantidad ?? 0} unids.`,
          precio: `S/. ${(item.precio || 0).toFixed(2)}`
        }));
        break;

      case 'alquileres':
        titulo = 'Reporte de Alquileres de Recepción';
        fileName = 'reporte_alquileres';
        columnas = ['ID Recepción', 'Habitación', 'Cliente', 'Fecha Entrada', 'Fecha Salida', 'Estado', 'Precio Inicial'];
        datosFormateados = data.map(item => ({
          id: item.idRecepcion ?? '',
          habitacion: `Hab. ${item.numeroHabitacion || item.idHabitacion || ''}`,
          cliente: item.nombreCliente || (`Cliente ID: ${item.idCliente}`),
          entrada: item.fechaEntrada ?? '',
          salida: item.fechaSalida ?? '',
          estado: item.estado ? 'Activa / En Curso' : 'Finalizada',
          precio: `S/. ${(item.precioInicial || 0).toFixed(2)}`
        }));
        break;

      case 'cuentasPorCobrar':
        titulo = 'Reporte de Cuentas por Cobrar';
        fileName = 'reporte_cuentas_por_cobrar';
        columnas = ['ID Recepción', 'Habitación', 'Cliente', 'Fecha Entrada', 'Adelanto', 'Costo Penalidad', 'Saldo Restante'];
        datosFormateados = data.map(item => ({
          id: item.idRecepcion ?? '',
          habitacion: `Hab. ${item.numeroHabitacion || item.idHabitacion || ''}`,
          cliente: item.nombreCliente || (`Cliente ID: ${item.idCliente}`),
          entrada: item.fechaEntrada ?? '',
          adelanto: `S/. ${(item.adelanto || 0).toFixed(2)}`,
          penalidad: `S/. ${(item.costoPenalidad || 0).toFixed(2)}`,
          saldo: `S/. ${(item.precioRestante || 0).toFixed(2)}`
        }));
        break;

      case 'penalidades':
        titulo = 'Resumen de Penalidades';
        fileName = 'reporte_penalidades';
        const penData = this.resumenPenalidadesData();
        columnas = ['Métrica', 'Valor'];
        datosFormateados = [
          { metrica: 'Total Penalidades Aplicadas', valor: penData?.totalPenalidadesAplicadas ?? 0 },
          { metrica: 'Monto Recaudado por Penalidades', valor: `S/. ${(penData?.montoTotalRecaudadoPenalidades || 0).toFixed(2)}` }
        ];
        break;
    }

    this.exportService.exportToPDF(datosFormateados, fileName, columnas, titulo);
  }

  exportarExcel(): void {
    const data = this.resultados();
    const tipo = this.tipoReporte();

    if ((!data || data.length === 0) && tipo !== 'penalidades') {
      return;
    }

    let fileName = `reporte_${tipo}`;
    let datosExportar: any[] = [];

    switch (tipo) {
      case 'ventas':
        datosExportar = data.map(item => ({
          'ID Producto': item.idProducto,
          'Nombre del Producto': item.nombreProducto,
          'Cantidad Vendida': item.cantidadVendida,
          'Ingreso Generado (S/.)': item.ingresoGenerado
        }));
        break;
      case 'stockBajo':
        datosExportar = data.map(item => ({
          'ID Producto': item.idProducto,
          'Producto': item.nombre,
          'Detalle': item.detalle || 'Sin detalles',
          'Stock Actual': item.cantidad,
          'Precio Unitario (S/.)': item.precio
        }));
        break;
      case 'alquileres':
        datosExportar = data.map(item => ({
          'ID Recepción': item.idRecepcion,
          'Habitación': item.numeroHabitacion || item.idHabitacion,
          'Cliente': item.nombreCliente || `Cliente ID: ${item.idCliente}`,
          'Fecha Entrada': item.fechaEntrada,
          'Fecha Salida': item.fechaSalida,
          'Estado': item.estado ? 'Activa / En Curso' : 'Finalizada',
          'Precio Inicial (S/.)': item.precioInicial
        }));
        break;
      case 'cuentasPorCobrar':
        datosExportar = data.map(item => ({
          'ID Recepción': item.idRecepcion,
          'Habitación': item.numeroHabitacion || item.idHabitacion,
          'Cliente': item.nombreCliente || `Cliente ID: ${item.idCliente}`,
          'Fecha Entrada': item.fechaEntrada,
          'Adelanto (S/.)': item.adelanto,
          'Costo Penalidad (S/.)': item.costoPenalidad,
          'Saldo Restante (S/.)': item.precioRestante
        }));
        break;
      case 'penalidades':
        const penData = this.resumenPenalidadesData();
        datosExportar = [
          { 'Métrica': 'Total Penalidades Aplicadas', 'Valor': penData?.totalPenalidadesAplicadas ?? 0 },
          { 'Métrica': 'Monto Recaudado por Penalidades (S/.)', 'Valor': penData?.montoTotalRecaudadoPenalidades ?? 0 }
        ];
        break;
    }

    this.exportService.exportToExcel(datosExportar, fileName);
  }
}
