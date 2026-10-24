import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-dashboard.html'
})
export class ClienteDashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  nombreCliente: string = 'Huésped';
  correoCliente: string = '';
  documentoCliente: string = '';
  idPersona: number | null = null;
  idRecepcionActiva!: number;

  ngOnInit(): void {
    this.cargarDatosCliente();
  }

  private cargarDatosCliente(): void {
    // 1. Obtenemos el ID de forma segura desde el AuthService
    const rawId = this.authService.getUserId();
    const parsedId = rawId ? Number(rawId) : NaN;

    if (Number.isFinite(parsedId) && parsedId > 0) {
      this.idPersona = parsedId;
    }

    // 2. Extraemos los datos personales guardados en el localStorage durante el login
    if (typeof window !== 'undefined') {
      const nombre = localStorage.getItem('user_nombre') || 'Huésped';
      const apellido = localStorage.getItem('user_apellido') || '';
      this.nombreCliente = `${nombre} ${apellido}`.trim();
      this.documentoCliente = localStorage.getItem('user_documento') || 'N/A';

      // Verificamos si hay alguna recepción activa guardada o en el historial
      const authData = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (authData) {
        try {
          const user = JSON.parse(authData);
          this.idRecepcionActiva = Number(user.idRecepcion || user.idrecepcion);
        } catch {
          // Ignorar error de parseo si el formato varía
        }
      }
    }
    this.cdr.markForCheck();
  }

  irAlRoomService(): void {
    if (this.idRecepcionActiva) {
      this.router.navigate([`/public/pedido/${this.idRecepcionActiva}`]);
    } else {
      Swal.fire('Atención', 'No tienes ninguna recepción activa en este momento.', 'info');
    }
  }

  irAEditarPerfil(): void {
    // Redirige a la vista de perfil del cliente para ver o actualizar sus datos
    this.router.navigate(['/cliente/perfil']);
  }
}
