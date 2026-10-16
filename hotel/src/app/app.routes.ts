
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/components/login/LoginComponent';
import { Layout } from '../app/features/layout/layout';
import { Resumensalida } from './features/salida-habitacion/procesarsalida/resumensalida/resumensalida';

export const routes: Routes = [
  // Ruta pública
  { path: 'login', component: LoginComponent },

  // ===================================================================
  // RUTAS DE ADMINISTRACIÓN (Protegidas: Solo Administrador)
  // ===================================================================
  {
    path: 'admin',
    canActivate: [authGuard],
    component: Layout,
    data: { roles: ['Administrador'] }, // El guard protegerá a todo este bloque
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboard)
      },
      {
        path: 'personas',
        loadComponent: () => import('./features/persona/components/persona-list/PersonaListComponent').then(m => m.PersonaListComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/persona/components/cliente-list/cliente-list').then(m => m.ClienteListComponent)
      },
      {
        path: 'habitacion',
        loadComponent: () => import('./features/habitacion/habitacion-list').then(m => m.HabitacionListComponent)
      },
      // ... dentro del bloque children del path 'admin' ...
{
  path: 'reportes',
  loadComponent: () => import('./features/reportes/reportes-manager/reportescomponent').then(m => m.ReportesComponent)
},
      {
        path: 'piso',
        loadComponent: () => import('./features/piso/piso').then(m => m.PisoComponent)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./features/categoria/categoria').then(m => m.CategoriaComponent)
      },
      {
        path: 'recepcion',
        loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent)
      },
      {
        path: 'recepciondetalle/:id',
        loadComponent: () => import('./features/recepcion/recepciondetalle/recepciondetalle').then(m => m.RecepcionDetalleComponent)
      },
      {
        path: 'venta',
        loadComponent: () => import('./features/habitacionescliente/listahabitacionesocupadas').then(m => m.ListaHabitacionesEstadoComponent),
        data: { tipoEstado: 2 }
      },
      /*
      {
        path: 'listahabitacionesdesocupadas',
        loadComponent: () => import('./features/listahabitacionesocupadas/listahabitacionesocupadas').then(m => m.ListaHabitacionesEstadoComponent),
        data: { tipoEstado: 1 }
      },*/


      {
        path: 'salidaHabitacion',
        loadComponent: () => import('./features/salida-habitacion/salida-habitacion').then(m => m.SalidaHabitacion)
      },
      {
        path: 'procesarsalida/:id',
        loadComponent: () => import('./features/salida-habitacion/procesarsalida/procesarsalida').then(m => m.Procesarsalida)
      },
      {
        path: 'ventaproductos/:id',
        loadComponent: () => import('./features/producto/ventaproductos/ventaproductos').then(m => m.Ventaproductos)
      },
      {
        path: 'crudproductos',
        loadComponent: () => import('./features/producto/productocomponent').then(m => m.ProductoComponent)
      }
    ]
  },

  // ===================================================================
  // RUTAS DE EMPLEADOS (Protegidas: Administrador y Empleado)
  // ===================================================================
  {
    path: 'empleado',
    canActivate: [authGuard],
    data: { roles: ['Administrador', 'Empleado'] }, // Permite ambos roles
    children: [
      {
        path: '',
        loadComponent: () => import('./features/empleado/empleado-dashboard/empleado-dashboard').then(m => m.EmpleadoDashboard)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/empleado/empleado-dashboard/empleado-dashboard').then(m => m.EmpleadoDashboard)
      }

    ]
  },

  {
    path: 'public/pedido/:idRecepcion',
    loadComponent: () => import('./features/productocliente/productocliente').then(m => m.ProductoClienteComponent)
  },
  // ===================================================================
  // RUTAS DE CLIENTES (Protegidas: Solo Cliente)
  // ===================================================================
 {
  path: 'cliente',
  canActivate: [authGuard],
  component: Layout,
  data: { roles: ['Cliente'] },
  children: [
    {
      path: '',
      loadComponent: () => import('./features/cliente/cliente-dashboard/cliente-dashboard').then(m => m.ClienteDashboard)
    },
    {
      path: 'catalogo',
      loadComponent: () => import('./features/cliente/Productos Cliente/catalogo-producto-component/catalogo-producto-component').then(m => m.CatalogoProductoComponent)
    },
    {
      path: 'carrito/:id',
      loadComponent: () => import('./features/cliente/Productos Cliente/catalogo-producto-component/Carrito/carrito-detalle/carrito-detalle').then(m => m.CarritoDetalle)
    },
    {
      path: 'habitacioncliente',
      loadComponent: () => import('./features/cliente/HabitacionCliente/habitacion-cliente-catalogo/habitacion-cliente').then(m => m.HabitacionCliente)
    },
    {
      path: 'datalleAlquiler/:id',
      loadComponent: () => import('./features/cliente/HabitacionCliente/AlquilerDetalle/alquiler-componente/alquiler-componente').then(m => m.AlquilerComponente)
    },
    {
      path: 'habitacionesocupadasCliente',
      loadComponent: () => import('./features/cliente/clientehabitacionesocupadas/listahabitacionesocupadascliente').then(m => m.ClientehabitacionesdISPONIBLES)
    }
  ]
},

{
  path: 'admin/resumensalida/:id',
  component: Resumensalida
},

  // Redirecciones globales obligatorias
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
