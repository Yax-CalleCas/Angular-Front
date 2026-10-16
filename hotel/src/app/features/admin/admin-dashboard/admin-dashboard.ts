import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ReporteService } from '../../../core/services/ReporteService';
import { DashboardStatsDto } from '../../../core/models/DashboardStatsDto';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
    styleUrls: ['./admin.css']

})
export class AdminDashboard {

  stats$: Observable<DashboardStatsDto>;

  constructor(private router: Router, private reporteService: ReporteService) {
    this.stats$ = this.reporteService.getDashboardStats();
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
