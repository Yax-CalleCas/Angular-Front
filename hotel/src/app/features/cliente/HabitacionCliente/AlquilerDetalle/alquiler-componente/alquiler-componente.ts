import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { HabitacionService } from '../../../../../core/services/habitacion.service';
import { PersonaService } from '../../../../../core/services/persona.service';
import { RecepcionService } from '../../../../../core/services/recepcion.service';

import { HabitacionResponseDTO } from '../../../../../core/models/Habitacion';
import { Persona } from '../../../../../core/models/persona.model';
import { Recepcion } from '../../../../../core/models/recepcion.model';

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

  private readonly habitacionService = inject(HabitacionService);
  private readonly personaService = inject(PersonaService);
  private readonly recepcionService = inject(RecepcionService);

  private readonly cdr = inject(ChangeDetectorRef);

  habitacion: HabitacionResponseDTO | null = null;
  persona: Persona | null = null;

  cargando = true;
  procesando = false;
  mostrarModalPago = false;

  alquilerForm: FormGroup = this.fb.group({
    fechaIngreso: [
      { value: new Date().toISOString().substring(0, 10), disabled: true }
    ],

    fechaSalida: [
      null,
      Validators.required
    ],

    clienteNombre: [
      { value: '', disabled: true }
    ],

    montoPagado: [
      0,
      [Validators.required, Validators.min(1)]
    ],

    observaciones: ['']
  });

  ngOnInit(): void {
    const idHabitacion = Number(this.route.snapshot.paramMap.get('id'));

    if (idHabitacion) {
      this.cargarHabitacion(idHabitacion);
    }

    this.cargarCliente();
  }

  cargarHabitacion(id: number): void {
    this.habitacionService.buscarPorId(id).subscribe({
      next: (res: any) => {
        this.habitacion = res.data ?? res;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
      }
    });
  }

  cargarCliente(): void {
    this.personaService.listar().subscribe({
      next: (personas) => {
        const cliente = personas.find(p => p.idTipoPersona === 3);

        if (!cliente) {
          console.error('Cliente no encontrado.');
          return;
        }

        this.persona = cliente;

        this.alquilerForm.patchValue({
          clienteNombre: `${cliente.nombre} ${cliente.apellido}`
        });

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  confirmarAlquiler(): void {
    if (this.alquilerForm.invalid) {
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
    const noches = Math.ceil(diferencia / (1000 * 60 * 60 * 24));

    return noches > 0 ? noches : 0;
  }

  get precioTotalCalculado(): number {
    return this.calcularNoches * (this.habitacion?.precio ?? 0);
  }

  procesarPagoFinal(): void {
    if (!this.habitacion || !this.persona) {
      return;
    }

    this.procesando = true;

    const montoIngresado = Number(this.alquilerForm.get('montoPagado')?.value) || 0;
    const total = this.precioTotalCalculado;

    // CORREGIDO: Se ajusta estrictamente a la interfaz Recepcion sin propiedades ajenas
    const dto: Recepcion = {
      idHabitacion: this.habitacion.idHabitacion ?? 0,
      idCliente: this.persona.idPersona ?? 0,
      fechaEntrada: this.alquilerForm.getRawValue().fechaIngreso ?? new Date().toISOString(),
      fechaSalida: this.alquilerForm.get('fechaSalida')?.value ?? '',
      observacion: this.alquilerForm.get('observaciones')?.value ?? '',
      precioInicial: total ?? 0,
      adelanto: montoIngresado < total ? montoIngresado : 0,
      totalPagado: montoIngresado >= total ? total : montoIngresado,
      precioRestante: Math.max(0, total - montoIngresado),
      estado: true
    };

    this.recepcionService.registrar(dto).subscribe({
      next: () => {
        this.procesando = false;
        this.mostrarModalPago = false;
        alert('Reserva registrada correctamente.');
        this.router.navigate(['/cliente/catalogo']);
      },
      error: (err) => {
        console.error(err);
        this.procesando = false;
      }
    });
  }

}
