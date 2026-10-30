import { Routes } from '@angular/router';
import { adminGuard, loginGuard } from './core/auth';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', title: 'Log in | ScenTop Admin', canActivate: [loginGuard], loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', title: 'Dashboard | ScenTop Admin', loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'orders', title: 'Orders | ScenTop Admin', loadComponent: () => import('./pages/orders/orders.page').then((m) => m.OrdersPage) },
      { path: 'products', title: 'Products | ScenTop Admin', loadComponent: () => import('./pages/products/products.page').then((m) => m.ProductsPage) },
      { path: 'customers', title: 'Customers | ScenTop Admin', loadComponent: () => import('./pages/customers/customers.page').then((m) => m.CustomersPage) },
      { path: 'messages', title: 'Inbox | ScenTop Admin', loadComponent: () => import('./pages/messages/messages.page').then((m) => m.MessagesPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
