import { Component, OnInit, DestroyRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { finalize, timeout } from 'rxjs';
import Swal from 'sweetalert2';

import { HabitacionService } from '../../../../../core/services/habitacion.service';
import { RecepcionService } from '../../../../../core/services/recepcion.service';
import { AuthService } from '../../../../../core/services/auth.service';

import { HabitacionResponseDTO } from '../../../../../core/models/Habitacion';
import { Persona } from '../../../../../core/models/persona.model';
import { RecepcionRequestDTO } from '../../../../../core/models/recepcion.model';
import { ApiResponse } from '../../../../../core/models/ApiResponse';

const TIMEOUT_CARGA_MS = 30000;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Fecha de hoy en hora local (YYYY-MM-DD). */
function hoyLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Component({
  selector: 'app-alquiler-componente',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './alquiler-componente.html',
  styleUrls: ['./alquiler-componente.css']
})
export class AlquilerComponente implements OnInit {

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  private readonly habitacionService = inject(HabitacionService);
  private readonly recepcionService = inject(RecepcionService);
  private readonly authService = inject(AuthService);

  private readonly cdr = inject(ChangeDetectorRef);

  habitacion: HabitacionResponseDTO | null = null;
  persona: Persona | null = null;

  cargando = true;
  procesando = false;
  mostrarModalPago = false;

  alquilerForm: FormGroup = this.fb.group({
    fechaIngreso: [
      { value: hoyLocal(), disabled: true }
    ],
    fechaSalida: [null, Validators.required],
    clienteNombre: [{ value: '', disabled: true }],
    montoPagado: [0, [Validators.required, Validators.min(1)]],
    observaciones: ['']
  });

  ngOnInit(): void {
    const idHabitacion = Number(this.route.snapshot.paramMap.get('id'));

    if (idHabitacion) {
      this.cargarHabitacion(idHabitacion);
    } else {
      this.cargando = false;
    }

    this.cargarClienteAutenticado();
  }

  private cargarHabitacion(id: number): void {
    this.habitacionService.buscarPorId(id)
      .pipe(
        timeout(TIMEOUT_CARGA_MS),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res: ApiResponse<HabitacionResponseDTO>) => {
          this.habitacion = res.data ?? null;
        },
        error: (err: unknown) => {
          console.error('Error al cargar la habitación:', err);
          Swal.fire('Error', 'No se pudo cargar la información de la habitación.', 'error');
        }
      });
  }

  private cargarClienteAutenticado(): void {
    const idPersonaString = this.authService.getUserId();
    const idPersona = idPersonaString ? Number(idPersonaString) : NaN;

    if (!Number.isFinite(idPersona) || idPersona <= 0) {
      Swal.fire('Error', 'No se pudo identificar la sesión del usuario.', 'error');
      this.router.navigate(['/login']);
      return;
    }

    // Leemos los datos completos (nombre, apellido y documento) guardados en el localStorage tras el login
    const nombre = localStorage.getItem('user_nombre') || 'Cliente';
    const apellido = localStorage.getItem('user_apellido') || '';
    const documento = localStorage.getItem('user_documento') || 'S/D';
    const nombreCompleto = `${nombre} ${apellido}`.trim();

    this.persona = {
      idPersona: idPersona,
      nombre: nombre,
      apellido: apellido,
      tipoDocumento: 'DNI',
      documento: documento,
      correo: '',
      idTipoPersona: 3
    };

    // Pintamos en el input del formulario el ID, Nombre y DNI de forma limpia
    this.alquilerForm.patchValue({
      clienteNombre: `ID: ${idPersona} | ${nombreCompleto} | DNI: ${documento}`
    });

    this.cdr.markForCheck();
  }

  confirmarAlquiler(): void {
    if (this.alquilerForm.invalid) {
      this.alquilerForm.markAllAsTouched();
      return;
    }

    if (this.calcularNoches < 1) {
      Swal.fire('Fechas inválidas', 'La fecha de salida debe ser posterior a la de ingreso.', 'warning');
      return;
    }

    const monto = Number(this.alquilerForm.get('montoPagado')?.value) || 0;
    if (monto > this.precioTotalCalculado) {
      Swal.fire('Monto inválido', 'El monto a pagar no puede superar el total de la reserva.', 'warning');
      return;
    }

    this.mostrarModalPago = true;
  }

  get calcularNoches(): number {
    const fechaIngreso = this.alquilerForm.getRawValue().fechaIngreso;
    const fechaSalida = this.alquilerForm.get('fechaSalida')?.value;

    if (!fechaIngreso || !fechaSalida) {
      return 0;
    }

    const ingreso = new Date(fechaIngreso);
    const salida = new Date(fechaSalida);

    const diferencia = salida.getTime() - ingreso.getTime();
    if (Number.isNaN(diferencia)) return 0;

    const noches = Math.ceil(diferencia / MS_POR_DIA);

    return noches > 0 ? noches : 0;
  }

  get precioTotalCalculado(): number {
    return this.calcularNoches * (this.habitacion?.precio ?? 0);
  }

  procesarPagoFinal(): void {
    if (this.procesando) return;
    if (!this.habitacion || !this.persona?.idPersona || !this.habitacion.idHabitacion) {
      Swal.fire('Error', 'Faltan datos de la habitación o del cliente para registrar la reserva.', 'error');
      return;
    }

    this.procesando = true;

    const montoIngresado = Number(this.alquilerForm.get('montoPagado')?.value) || 0;
    const total = this.precioTotalCalculado;
    const observacion = String(this.alquilerForm.get('observaciones')?.value ?? '').trim();

    const dto: RecepcionRequestDTO = {
      idCliente: this.persona.idPersona,
      idHabitacion: this.habitacion.idHabitacion,
      fechaEntrada: this.alquilerForm.getRawValue().fechaIngreso ?? '',
      fechaSalida: this.alquilerForm.get('fechaSalida')?.value ?? '',
      precioInicial: total,
      adelanto: montoIngresado,
      observacion: observacion || undefined
    };

    this.recepcionService.registrar(dto)
      .pipe(
        finalize(() => {
          this.procesando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.mostrarModalPago = false;
          Swal.fire('¡Éxito!', 'Reserva registrada correctamente.', 'success');
          this.router.navigate(['/cliente/habitacionesocupadasCliente']);
        },
        error: (err: unknown) => {
          console.error('Error al registrar la recepción:', err);
          Swal.fire('Error', this.mensajeError(err, 'No se pudo procesar tu reserva. Inténtalo nuevamente.'), 'error');
        }
      });
  }

  private mensajeError(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string } | string | null;
      if (body && typeof body === 'object' && body.message) return body.message;
    }
    return porDefecto;
  }
}
