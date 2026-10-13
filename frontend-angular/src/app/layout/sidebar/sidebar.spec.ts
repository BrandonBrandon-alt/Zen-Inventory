import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/session/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { BranchLabelApi } from '../data-access/branch-label-api';
import { SIDEBAR_STORAGE_KEY } from '../sidebar-state';
import { Sidebar } from './sidebar';

const sessionFor = (rol: string) => ({ token: 't', email: 'e', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

async function renderSidebar(rol: string) {
  return render(Sidebar, {
    providers: [provideRouter([]), { provide: BranchLabelApi, useValue: { labelFor: () => of('Norte') } }],
    configureTestBed: (bed) => bed.inject(AuthStore).start(sessionFor(rol)),
  });
}

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('un ADMIN ve la navegación completa y los maestros', async () => {
    await renderSidebar('ADMIN');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    for (const name of ['Panel', 'Inventario', 'Usuarios', 'Productos', 'Proveedores', 'Unidades de medida']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Maestros')).toBeInTheDocument();
  });

  it('un OPERADOR_INVENTARIO no ve administración ni maestros', async () => {
    await renderSidebar('OPERADOR_INVENTARIO');
    expect(screen.getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    for (const name of ['Usuarios', 'Alertas', 'Productos', 'Sucursales']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Maestros')).not.toBeInTheDocument();
  });

  it('cada enlace apunta a su ruta', async () => {
    await renderSidebar('ADMIN');
    expect(screen.getByRole('link', { name: 'Historial Ventas' })).toHaveAttribute('href', '/sales/history');
  });

  it('muestra la tarjeta del usuario con su sucursal', async () => {
    await renderSidebar('MANAGER');
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(await screen.findByText('Norte')).toBeInTheDocument();
  });

  it('colapsar conserva los nombres accesibles de los enlaces y persiste el estado', async () => {
    await renderSidebar('ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
    const link = screen.getByRole('link', { name: 'Inventario' });
    // Sin texto visible, el nombre debe venir de aria-label: `title` no es una fuente fiable para lectores de pantalla.
    expect(link).toHaveAttribute('aria-label', 'Inventario');
    expect(screen.queryByText('Norte')).not.toBeInTheDocument();
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
  });

  it('el botón de tema alterna entre oscuro y claro', async () => {
    await renderSidebar('ADMIN');
    await userEvent.click(screen.getByRole('button', { name: 'Modo claro' }));
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Modo oscuro' })).toBeInTheDocument();
  });

  it('cerrar sesión limpia la sesión y navega al login', async () => {
    await renderSidebar('ADMIN');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
