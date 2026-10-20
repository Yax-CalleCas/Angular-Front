
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin.css']
})
export class AdminDashboard {

  constructor(private router: Router) {}

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
