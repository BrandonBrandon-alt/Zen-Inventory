import {
  LucideBell,
  LucideFileText,
  LucideLayers,
  LucideLayoutDashboard,
  LucidePackage,
  LucideReceipt,
  LucideRotateCcwClock,
  LucideRuler,
  LucideShoppingBag,
  LucideShuffle,
  LucideStore,
  LucideTruck,
  LucideUndo2,
  LucideUsers,
  type LucideIconData,
} from '@lucide/angular';
import { ALERT_ROLES } from '@core/alerts/alert-count';
import { ROLES, type Role } from '@core/auth/roles/role';

export interface NavItem {
  readonly label: string;
  /** Ruta absoluta de la app (con `/` inicial). */
  readonly path: string;
  readonly icon: LucideIconData;
  readonly roles: readonly Role[];
  /** Muestra en el menú cuántas alertas activas hay junto a este ítem. */
  readonly alertBadge?: boolean;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

const EVERYONE: readonly Role[] = ROLES;
const MANAGEMENT: readonly Role[] = ['ADMIN', 'MANAGER', 'SELLER'];
const ADMIN_ONLY: readonly Role[] = ['ADMIN'];
/** Quienes administran usuarios: el ADMIN (todos) y el MANAGER (los de su sucursal). */
const USER_ADMINS: readonly Role[] = ['ADMIN', 'MANAGER'];

/** Fuente única del menú y de las rutas protegidas del shell. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Navegación',
    items: [
      { label: 'Panel', path: '/dashboard', icon: LucideLayoutDashboard.icon, roles: EVERYONE },
      { label: 'Inventario', path: '/inventory', icon: LucideLayers.icon, roles: EVERYONE },
      { label: 'Alertas', path: '/alerts', icon: LucideBell.icon, roles: ALERT_ROLES, alertBadge: true },
      { label: 'Traslados', path: '/transfers', icon: LucideShuffle.icon, roles: EVERYONE },
      { label: 'Compras', path: '/purchases', icon: LucideShoppingBag.icon, roles: EVERYONE },
      { label: 'Ventas', path: '/sales/pos', icon: LucideReceipt.icon, roles: EVERYONE },
      { label: 'Historial Ventas', path: '/sales/history', icon: LucideRotateCcwClock.icon, roles: EVERYONE },
      { label: 'Devoluciones', path: '/returns', icon: LucideUndo2.icon, roles: EVERYONE },
      { label: 'Sucursales', path: '/branches', icon: LucideStore.icon, roles: ADMIN_ONLY },
      { label: 'Usuarios', path: '/users', icon: LucideUsers.icon, roles: USER_ADMINS },
      { label: 'Auditoría Global', path: '/audit', icon: LucideFileText.icon, roles: MANAGEMENT },
    ],
  },
  {
    title: 'Maestros',
    items: [
      { label: 'Productos', path: '/catalog/products', icon: LucidePackage.icon, roles: ADMIN_ONLY },
      { label: 'Proveedores', path: '/catalog/suppliers', icon: LucideTruck.icon, roles: ADMIN_ONLY },
      { label: 'Unidades de medida', path: '/catalog/units', icon: LucideRuler.icon, roles: ADMIN_ONLY },
    ],
  },
];

/** Secciones del menú visibles para un rol; descarta las que quedan vacías. */
export function navSectionsFor(role: Role | null): NavSection[] {
  if (role === null) return [];
  return NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
