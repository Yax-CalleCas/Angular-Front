import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ReporteService } from '../../../core/services/ReporteService';
import { ExportService } from '../../../core/services/ExportService';
import { ReporteVentaDto, ReporteHabitacionDto, ReporteCobroDto } from '../../../core/models/reporte.models';

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

  fechaInicio = signal<string>(new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 16));
  fechaFin = signal<string>(new Date().toISOString().slice(0, 16));
  tipoReporte = signal<'ventas' | 'ocupacion' | 'cobros'>('ventas');

  resultados = signal<any[]>([]);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  totalGeneral = computed<number>(() => {
    const data = this.resultados();
    const type = this.tipoReporte();
    if (type === 'ventas') return (data as ReporteVentaDto[]).reduce((acc, curr) => acc + (curr.totalIngresado || 0), 0);
    if (type === 'cobros') return (data as ReporteCobroDto[]).reduce((acc, curr) => acc + (curr.totalGeneral || 0), 0);
    return 0;
  });

  ngOnInit(): void {
    this.generarReporte();
  }

  generarReporte(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.getObservable(this.tipoReporte(), this.fechaInicio(), this.fechaFin())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.resultados.set(data || []),
        error: (err: unknown) => {
          console.error('Error:', err);
          this.errorMessage.set('Error al conectar con el servidor.');
          this.resultados.set([]);
        }
      });
  }

  exportarExcel(): void {
    if (this.resultados().length === 0) return;
    this.exportService.exportToExcel(this.resultados(), `Reporte_${this.tipoReporte()}`);
  }

  exportarPDF(): void {
    if (this.resultados().length === 0) return;
    const tipo = this.tipoReporte();
    const columnas = tipo === 'ventas' ? ['Producto', 'Cantidad', 'Ingreso'] :
                     tipo === 'cobros' ? ['Habitación', 'Cliente', 'Alojamiento', 'Consumos', 'Total', 'Fecha'] :
                     ['Habitación', 'Categoría', 'Veces Alquilada'];
    this.exportService.exportToPDF(this.resultados(), `Reporte_${tipo}`, columnas, `Reporte de ${tipo}`);
  }

  private getObservable(tipo: string, inicio: string, fin: string): Observable<any[]> {
    switch (tipo) {
      case 'ventas': return this.service.getVentas(inicio, fin);
      case 'cobros': return this.service.getCobros(inicio, fin);
      default: return this.service.getOcupacion(inicio, fin);
    }
  }

  cambiarTipo(tipo: 'ventas' | 'ocupacion' | 'cobros'): void {
    this.tipoReporte.set(tipo);
    this.generarReporte();
  }
}
