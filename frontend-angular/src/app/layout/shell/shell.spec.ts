import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/session/auth-store';
import { expectAccessible } from '@testing/a11y';
import { BranchLabelApi } from '../data-access/branch-label-api';
import { MobileMenu } from '../mobile-menu';
import { Shell } from './shell';

function mockViewport(desktop: boolean): void {
  const query = { matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: vi.fn().mockReturnValue(query) });
}

async function renderShell(desktop: boolean) {
  mockViewport(desktop);
  const result = await render(Shell, {
    providers: [
      provideRouter([
        { path: 'inventory', children: [] },
        { path: 'dashboard', children: [] },
      ]),
      { provide: BranchLabelApi, useValue: { labelFor: () => of('Norte') } },
    ],
    configureTestBed: (bed) =>
      bed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'Ana', rol: 'ADMIN', id: 1, sucursalId: 3 }),
  });
  return { ...result, sidebar: result.container.querySelector('app-sidebar') as HTMLElement };
}

describe('Shell', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => delete (window as { matchMedia?: unknown }).matchMedia);

  describe('escritorio', () => {
    it('el menú y la estructura de la página no tienen problemas de accesibilidad detectables', async () => {
      await renderShell(true);
      await expectAccessible();
    });

    it('el primer elemento al tabular es «Saltar al contenido», que pasa el foco al contenido sin cambiar la URL', async () => {
      await renderShell(true);
      const router = TestBed.inject(Router);
      const url = router.url;
      await userEvent.tab();
      const skip = screen.getByRole('link', { name: 'Saltar al contenido' });
      expect(skip).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(document.getElementById('contenido')).toHaveFocus();
      expect(router.url).toBe(url);
    });

    it('muestra el menú siempre y no hay barra superior ni botón de menú', async () => {
      const { sidebar } = await renderShell(true);
      expect(sidebar).not.toHaveAttribute('inert');
      expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    });

    it('conserva el botón de colapsar y el borde arrastrable', async () => {
      await renderShell(true);
      expect(screen.getByRole('button', { name: 'Contraer menú' })).toBeInTheDocument();
      expect(screen.getByRole('separator', { name: 'Cambiar ancho del menú' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cerrar menú' })).not.toBeInTheDocument();
    });
  });

  describe('móvil', () => {
    it('el menú empieza cerrado: inactivo (no se puede enfocar ni leer) y hay un botón para abrirlo', async () => {
      const { sidebar } = await renderShell(false);
      expect(sidebar).toHaveAttribute('inert');
      expect(sidebar).toHaveClass('-translate-x-full');
      const open = screen.getByRole('button', { name: 'Abrir menú' });
      expect(open).toHaveAttribute('aria-expanded', 'false');
      expect(open).toHaveAttribute('aria-controls', 'app-sidebar');
    });

    it('al pulsar el botón se abre el cajón con fondo oscurecido', async () => {
      const { sidebar, container } = await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      expect(sidebar).not.toHaveAttribute('inert');
      expect(sidebar).not.toHaveClass('-translate-x-full');
      expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('.bg-black\\/50')).not.toBeNull();
    });

    it('el cajón siempre se ve completo aunque el menú de escritorio estuviera colapsado, sin controles de escritorio', async () => {
      localStorage.setItem('zen_inventory_sidebar_collapsed', 'true');
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      expect(screen.getByText('Inventario')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Contraer menú' })).not.toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('en móvil no hay controles de escritorio (colapsar ni arrastrar el borde) aunque el menú no esté colapsado', async () => {
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Contraer menú' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Expandir menú' })).not.toBeInTheDocument();
    });

    it('el botón "Cerrar menú" del cajón lo cierra', async () => {
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
      expect(TestBed.inject(MobileMenu).open()).toBe(false);
    });

    it('pulsar fuera (el fondo) lo cierra', async () => {
      const { container } = await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await userEvent.click(container.querySelector('.bg-black\\/50') as HTMLElement);
      expect(TestBed.inject(MobileMenu).open()).toBe(false);
      expect(container.querySelector('.bg-black\\/50')).toBeNull();
    });

    it('Escape lo cierra', async () => {
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await userEvent.keyboard('{Escape}');
      expect(TestBed.inject(MobileMenu).open()).toBe(false);
    });

    it('elegir una pantalla navega y cierra el cajón', async () => {
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await userEvent.click(screen.getByRole('link', { name: 'Inventario' }));
      await vi.waitFor(() => expect(TestBed.inject(MobileMenu).open()).toBe(false));
      expect(TestBed.inject(Router).url).toBe('/inventory');
    });

    it('al cerrar sesión desde el cajón sigue funcionando', async () => {
      await renderShell(false);
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
    });
  });
});
