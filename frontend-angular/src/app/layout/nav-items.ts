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
  /** Una frase que dice para qué sirve la pantalla: se muestra al pasar el cursor o enfocar el enlace. */
  readonly description: string;
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
/** Traslados y compras son de gerencia e inventario (el backend responde 403 al vendedor). */
const STOCK_ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO'];
/** Quienes administran usuarios: el ADMIN (todos) y el MANAGER (los de su sucursal). */
const USER_ADMINS: readonly Role[] = ['ADMIN', 'MANAGER'];

/** Fuente única del menú y de las rutas protegidas del shell. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: 'Navegación',
    items: [
      { label: 'Panel', description: 'Resumen del negocio: ventas, inventario, traslados y lo que necesita atención.', path: '/dashboard', icon: LucideLayoutDashboard.icon, roles: EVERYONE },
      { label: 'Inventario', description: 'Existencias por producto, ajuste de stock, mínimos y el kardex de movimientos.', path: '/inventory', icon: LucideLayers.icon, roles: EVERYONE },
      { label: 'Alertas', description: 'Productos bajo su mínimo y otros avisos que esperan una acción.', path: '/alerts', icon: LucideBell.icon, roles: ALERT_ROLES, alertBadge: true },
      { label: 'Traslados', description: 'Pedir, aprobar, despachar y recibir mercancía entre sucursales.', path: '/transfers', icon: LucideShuffle.icon, roles: STOCK_ROLES },
      { label: 'Compras', description: 'Órdenes de compra a proveedores y recepción de la mercancía.', path: '/purchases', icon: LucideShoppingBag.icon, roles: STOCK_ROLES },
      { label: 'Ventas', description: 'Punto de venta: registra una venta nueva.', path: '/sales/pos', icon: LucideReceipt.icon, roles: EVERYONE },
      { label: 'Historial Ventas', description: 'Consulta las ventas ya registradas y anula las que lo necesiten.', path: '/sales/history', icon: LucideRotateCcwClock.icon, roles: EVERYONE },
      { label: 'Devoluciones', description: 'Registra y revisa las devoluciones de los clientes.', path: '/returns', icon: LucideUndo2.icon, roles: EVERYONE },
      { label: 'Sucursales', description: 'Crea y administra las sedes de la empresa.', path: '/branches', icon: LucideStore.icon, roles: ADMIN_ONLY },
      { label: 'Usuarios', description: 'Personas con acceso al sistema, sus roles y sus sucursales.', path: '/users', icon: LucideUsers.icon, roles: USER_ADMINS },
      { label: 'Auditoría Global', description: 'Registro de quién hizo qué en el sistema.', path: '/audit', icon: LucideFileText.icon, roles: MANAGEMENT },
    ],
  },
  {
    title: 'Maestros',
    items: [
      { label: 'Productos', description: 'Catálogo: productos, precios, proveedores y unidades alternas.', path: '/catalog/products', icon: LucidePackage.icon, roles: ADMIN_ONLY },
      { label: 'Proveedores', description: 'Empresas a las que se compra y sus tiempos de entrega.', path: '/catalog/suppliers', icon: LucideTruck.icon, roles: ADMIN_ONLY },
      { label: 'Unidades de medida', description: 'Unidades en que se cuentan los productos: kilo, caja, unidad…', path: '/catalog/units', icon: LucideRuler.icon, roles: ADMIN_ONLY },
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
