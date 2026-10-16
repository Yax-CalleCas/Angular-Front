import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-dashboard.html',
})
export class ClienteDashboard implements OnInit {
  private readonly router = inject(Router);

  nombreCliente: string = 'Huésped';
  idRecepcionActiva!: number;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const authData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (authData) {
        const user = JSON.parse(authData);
        this.nombreCliente = user.nombre || 'Huésped';
        this.idRecepcionActiva = Number(user.idRecepcion || user.idrecepcion);
      }
    }
  }

  irAlRoomService(): void {
    if (this.idRecepcionActiva) {
      this.router.navigate([`/public/pedido/${this.idRecepcionActiva}`]);
    }
  }
}
