import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ReporteService } from '../../../core/services/ReporteService';
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

  // Selector de tipo de reporte activo
  tipoReporte = signal<'ventas' | 'stockBajo' | 'alquileres' | 'cuentasPorCobrar' | 'penalidades'>('ventas');

  resultados = signal<any[]>([]);
  resumenPenalidadesData = signal<any>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Cálculo de totales generales dinámicos según el reporte activo
// Cálculo de totales generales dinámicos según el reporte activo
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

  ngOnInit(): void {
    this.generarReporte();
  }

  generarReporte(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resumenPenalidadesData.set(null);

    const tipo = this.tipoReporte();
    let obs$: Observable<any>;

    switch (tipo) {
      case 'ventas':
        obs$ = this.service.getProductosMasVendidos();
        break;
      case 'stockBajo':
        obs$ = this.service.getStockBajo(5);
        break;
      case 'alquileres':
        obs$ = this.service.getAlquileres();
        break;
      case 'cuentasPorCobrar':
        obs$ = this.service.getCuentasPorCobrar();
        break;
      case 'penalidades':
        obs$ = this.service.getResumenPenalidades();
        break;
      default:
        obs$ = this.service.getProductosMasVendidos();
    }

    obs$.pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          if (tipo === 'penalidades') {
            this.resumenPenalidadesData.set(data);
            this.resultados.set([]);
          } else {
            this.resultados.set(data || []);
          }
        },
        error: (err) => {
          console.error('Error al generar reporte:', err);
          this.errorMessage.set('Error al conectar con el servidor de reportes.');
          this.resultados.set([]);
        }
      });
  }

  cambiarTipo(tipo: 'ventas' | 'stockBajo' | 'alquileres' | 'cuentasPorCobrar' | 'penalidades'): void {
    this.tipoReporte.set(tipo);
    this.generarReporte();
  }
}
