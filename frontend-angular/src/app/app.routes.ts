import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';
import { authGuard } from '@core/auth/guards/auth.guard';
import { guestGuard } from '@core/auth/guards/guest.guard';
import { roleGuard } from '@core/auth/guards/role.guard';
import { NAV_SECTIONS } from './layout/nav-items';

const APP_TITLE = 'Zen Inventory';

const loadNotMigrated = () =>
  import('./features/not-migrated/pages/not-migrated-page/not-migrated-page').then((m) => m.NotMigratedPage);

/** Pantallas ya migradas, por ruta del menú. Las demás muestran `NotMigratedPage`. */
const IMPLEMENTED: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  '/branches': () =>
    import('./features/branches/pages/branches-page/branches-page').then((m) => m.BranchesPage),
  '/dashboard': () => import('./features/dashboard/pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  '/inventory': () => import('./features/inventory/pages/inventory-page/inventory-page').then((m) => m.InventoryPage),
  '/users': () => import('./features/users/pages/users-page/users-page').then((m) => m.UsersPage),
};

/** Una ruta por ítem del menú, con su guarda de roles. Al migrar una pantalla se cambia su `loadComponent`. */
const menuRoutes: Routes = NAV_SECTIONS.flatMap((section) => section.items).map((item) => ({
  path: item.path.replace(/^\//, ''),
  title: `${item.label} | ${APP_TITLE}`,
  data: { title: item.label },
  canActivate: [roleGuard(...item.roles)],
  loadComponent: IMPLEMENTED[item.path] ?? loadNotMigrated,
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
      ...menuRoutes,
    ],
  },
  { path: '**', redirectTo: '' },
];
