import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { guestGuard } from '@core/auth/guards/guest.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { NAV_SECTIONS } from './layout/nav-items';

const APP_TITLE = 'Zen Inventory';

/** La pantalla de cada ítem del menú, por su ruta. Un ítem sin pantalla aquí no pasa las pruebas (ver `app.routes.spec.ts`). */
export const SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  '/branches': () =>
    import('./features/branches/pages/branches-page/branches-page').then((m) => m.BranchesPage),
  '/dashboard': () => import('./features/dashboard/pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  '/catalog/products': () => import('./features/products/pages/products-page/products-page').then((m) => m.ProductsPage),
  '/catalog/units': () => import('./features/units/pages/units-page/units-page').then((m) => m.UnitsPage),
  '/catalog/suppliers': () => import('./features/suppliers/pages/suppliers-page/suppliers-page').then((m) => m.SuppliersPage),
  '/alerts': () => import('./features/alerts/pages/alerts-page/alerts-page').then((m) => m.AlertsPage),
  '/transfers': () => import('./features/transfers/pages/transfers-page/transfers-page').then((m) => m.TransfersPage),
  '/purchases': () => import('./features/purchases/pages/purchases-page/purchases-page').then((m) => m.PurchasesPage),
  '/sales/pos': () => import('./features/sales/pages/pos-page/pos-page').then((m) => m.PosPage),
  '/sales/history': () => import('./features/sales/pages/sales-history-page/sales-history-page').then((m) => m.SalesHistoryPage),
  '/audit': () => import('./features/audit/pages/audit-page/audit-page').then((m) => m.AuditPage),
  '/reports': () => import('./features/reports/pages/reports-page/reports-page').then((m) => m.ReportsPage),
  '/returns': () => import('./features/returns/pages/returns-page/returns-page').then((m) => m.ReturnsPage),
  '/inventory': () => import('./features/inventory/pages/inventory-page/inventory-page').then((m) => m.InventoryPage),
  '/users': () => import('./features/users/pages/users-page/users-page').then((m) => m.UsersPage),
};

/** Una ruta por ítem del menú, con su guarda de roles. */
const menuRoutes: Routes = NAV_SECTIONS.flatMap((section) => section.items).map((item) => ({
  path: item.path.replace(/^\//, ''),
  title: `${item.label} | ${APP_TITLE}`,
  data: { title: item.label },
  canActivate: [roleGuard(...item.roles)],
  loadComponent: SCREENS[item.path],
}));

export const routes: Routes = [
  {
    path: 'login',
    title: `Ingresar | ${APP_TITLE}`,
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    // Defensa en profundidad: cada ruta hija ya valida su rol (y manda al login sin sesión), pero una ruta
    // futura registrada sin `roleGuard` seguiría protegida por esta guarda.
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      // Cuenta propia: no está en el menú, se llega desde la tarjeta del usuario. Cualquier rol con sesión puede entrar.
      {
        path: 'profile',
        title: `Mi perfil | ${APP_TITLE}`,
        data: { title: 'Mi perfil' },
        loadComponent: () => import('./features/profile/pages/profile-page/profile-page').then((m) => m.ProfilePage),
      },
      ...menuRoutes,
    ],
  },
  { path: '**', redirectTo: '' },
];
