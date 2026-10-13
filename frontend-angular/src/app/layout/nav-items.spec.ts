import { describe, expect, it } from 'vitest';
import { ROLES } from '@core/auth/roles/role';
import { NAV_SECTIONS, navSectionsFor } from './nav-items';

const labels = (role: Parameters<typeof navSectionsFor>[0]) =>
  navSectionsFor(role).flatMap((section) => section.items.map((item) => item.label));

const allItems = NAV_SECTIONS.flatMap((section) => section.items);

describe('NAV_SECTIONS', () => {
  it('no repite rutas', () => {
    const paths = allItems.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('todas las rutas empiezan por / y tienen al menos un rol', () => {
    for (const item of allItems) {
      expect(item.path.startsWith('/')).toBe(true);
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });

  it('el Panel es accesible para todos los roles (destino de las redirecciones de guarda)', () => {
    const dashboard = allItems.find((item) => item.path === '/dashboard');
    expect([...(dashboard?.roles ?? [])].sort()).toEqual([...ROLES].sort());
  });
});

describe('navSectionsFor', () => {
  it('ADMIN ve todo, incluidos los maestros', () => {
    expect(labels('ADMIN')).toEqual(allItems.map((item) => item.label));
    expect(navSectionsFor('ADMIN').map((section) => section.title)).toEqual(['Navegación', 'Maestros']);
  });

  it('OPERADOR_INVENTARIO solo ve las pantallas operativas', () => {
    expect(labels('OPERADOR_INVENTARIO')).toEqual([
      'Panel',
      'Inventario',
      'Traslados',
      'Compras',
      'Ventas',
      'Historial Ventas',
      'Devoluciones',
    ]);
    expect(navSectionsFor('OPERADOR_INVENTARIO').map((section) => section.title)).toEqual(['Navegación']);
  });

  it.each(['MANAGER', 'SELLER'] as const)('%s ve toda la navegación y ningún maestro', (role) => {
    const visible = labels(role);
    expect(visible).toContain('Usuarios');
    expect(visible).toContain('Alertas');
    expect(visible).not.toContain('Productos');
    expect(navSectionsFor(role).map((section) => section.title)).toEqual(['Navegación']);
  });

  it('sin rol no muestra nada', () => {
    expect(navSectionsFor(null)).toEqual([]);
  });
});
