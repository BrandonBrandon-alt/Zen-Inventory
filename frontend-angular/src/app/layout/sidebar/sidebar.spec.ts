import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { AlertCount } from '@core/alerts/alert-count';
import { AuthStore } from '@core/auth/session/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { BranchLabelApi } from '../data-access/branch-label-api';
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../sidebar-state';
import { Sidebar } from './sidebar';

const sessionFor = (rol: string) => ({ token: 't', email: 'e', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

const alertTotal = signal(0);

async function renderSidebar(rol: string) {
  return render(Sidebar, {
    providers: [
      provideRouter([]),
      { provide: BranchLabelApi, useValue: { labelFor: () => of('Norte') } },
      { provide: AlertCount, useValue: { count: alertTotal.asReadonly(), refresh: () => undefined } },
    ],
    configureTestBed: (bed) => bed.inject(AuthStore).start(sessionFor(rol)),
  });
}

describe('Sidebar', () => {
  beforeEach(() => {
    alertTotal.set(0);
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
    for (const name of ['Usuarios', 'Productos', 'Sucursales']) {
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

  describe('redimensionar arrastrando el borde', () => {
    const handle = () => screen.getByRole('separator', { name: 'Cambiar ancho del menú' });
    const width = () => Number(handle().getAttribute('aria-valuenow'));
    const aside = (container: HTMLElement) => container.querySelector('aside') as HTMLElement;

    it('expone un separador accesible con el ancho actual y sus límites', async () => {
      await renderSidebar('ADMIN');
      expect(handle()).toHaveAttribute('aria-orientation', 'vertical');
      expect(handle()).toHaveAttribute('aria-valuemin', String(SIDEBAR_MIN_WIDTH));
      expect(handle()).toHaveAttribute('aria-valuemax', String(SIDEBAR_MAX_WIDTH));
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH);
      expect(handle()).toHaveAttribute('tabindex', '0');
    });

    it('arrastrar con el puntero cambia el ancho del menú', async () => {
      const { container } = await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 300, pointerId: 1 });
      expect(width()).toBe(300);
      expect(aside(container)).toHaveStyle({ width: '300px' });
      fireEvent.pointerUp(handle(), { pointerId: 1 });
    });

    it('al arrastrar respeta el ancho mínimo y el máximo', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 900, pointerId: 1 });
      expect(width()).toBe(SIDEBAR_MAX_WIDTH);
      fireEvent.pointerMove(handle(), { clientX: 20, pointerId: 1 });
      expect(width()).toBe(SIDEBAR_MIN_WIDTH);
    });

    it('al soltar deja de seguir al puntero y recuerda el ancho', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 310, pointerId: 1 });
      fireEvent.pointerUp(handle(), { pointerId: 1 });
      fireEvent.pointerMove(handle(), { clientX: 220, pointerId: 1 });
      expect(width()).toBe(310);
      expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('310');
    });

    it('cancelar el gesto también deja de seguir al puntero', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 280, pointerId: 1 });
      fireEvent.pointerCancel(handle(), { pointerId: 1 });
      fireEvent.pointerMove(handle(), { clientX: 350, pointerId: 1 });
      expect(width()).toBe(280);
    });

    it('mover el puntero sin haber pulsado no cambia nada', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerMove(handle(), { clientX: 330, pointerId: 1 });
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });

    it('un clic que no es el principal (derecho) no inicia el arrastre', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 2 });
      fireEvent.pointerMove(handle(), { clientX: 330, pointerId: 1 });
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });

    it('mientras se arrastra se marca el menú como "redimensionando" y el ancho nunca se anima', async () => {
      const { container } = await renderSidebar('ADMIN');
      expect(aside(container)).not.toHaveClass('transition-[width]');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      expect(aside(container)).not.toHaveClass('transition-[width]');
      fireEvent.pointerUp(handle(), { pointerId: 1 });
      expect(aside(container)).not.toHaveClass('transition-[width]');
    });

    it('con el teclado: flechas cambian 16 px, Inicio y Fin van a los límites', async () => {
      await renderSidebar('ADMIN');
      handle().focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH + 16);
      await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH - 16);
      await userEvent.keyboard('{End}');
      expect(width()).toBe(SIDEBAR_MAX_WIDTH);
      await userEvent.keyboard('{Home}');
      expect(width()).toBe(SIDEBAR_MIN_WIDTH);
    });

    it('con el teclado nunca se pasa de los límites', async () => {
      await renderSidebar('ADMIN');
      handle().focus();
      await userEvent.keyboard('{Home}{ArrowLeft}');
      expect(width()).toBe(SIDEBAR_MIN_WIDTH);
      await userEvent.keyboard('{End}{ArrowRight}');
      expect(width()).toBe(SIDEBAR_MAX_WIDTH);
    });

    it('doble clic en el borde vuelve al ancho estándar', async () => {
      await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 330, pointerId: 1 });
      fireEvent.pointerUp(handle(), { pointerId: 1 });
      expect(width()).toBe(330);
      fireEvent.dblClick(handle());
      expect(width()).toBe(SIDEBAR_DEFAULT_WIDTH);
    });

    it('colapsado no hay borde arrastrable y el menú mide 80 px; al expandir vuelve el ancho elegido', async () => {
      const { container } = await renderSidebar('ADMIN');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.pointerMove(handle(), { clientX: 320, pointerId: 1 });
      fireEvent.pointerUp(handle(), { pointerId: 1 });

      await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      expect(aside(container)).toHaveStyle({ width: '80px' });

      await userEvent.click(screen.getByRole('button', { name: 'Expandir menú' }));
      expect(width()).toBe(320);
      expect(aside(container)).toHaveStyle({ width: '320px' });
    });
  });

  it('en escritorio el menú no usa w-full: crecería desde el ancho mínimo hasta su ancho fijo al aparecer', async () => {
    const { container } = await renderSidebar('ADMIN');
    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside).not.toHaveClass('w-full');
    expect(aside).toHaveStyle({ width: '240px' });
  });

  describe('movimiento del ancho', () => {
    const aside = (container: Element) => container.querySelector('aside') as HTMLElement;

    it('al pulsar el botón del borde el ancho se anima un instante (150 ms) y luego vuelve a quedar sin transición', async () => {
      const { container } = await renderSidebar('ADMIN');
      await userEvent.click(screen.getByRole('button', { name: 'Contraer menú' }));
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
      expect(aside(container)).toHaveClass('transition-[width]');
      expect(aside(container)).toHaveClass('duration-150');
      await vi.waitFor(() => expect(aside(container)).not.toHaveClass('transition-[width]'));
    });

    it('con el atajo Ctrl + S el ancho cambia al instante, sin transición (acción del teclado)', async () => {
      const { container, fixture } = await renderSidebar('ADMIN');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
      expect(aside(container)).not.toHaveClass('transition-[width]');
    });
  });

  describe('atajo Ctrl + S', () => {
    // Los eventos del documento no pasan por Testing Library: tras cada uno se actualiza la vista a mano.
    const press = (fixture: { detectChanges: () => void }, init: KeyboardEventInit = { key: 's', ctrlKey: true }) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      document.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('contrae y expande el menú a iconos, y evita el "Guardar página" del navegador', async () => {
      const { fixture } = await renderSidebar('ADMIN');
      const first = press(fixture);
      expect(first.defaultPrevented).toBe(true);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
      press(fixture);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
    });

    it('también con ⌘ + S y sin distinguir mayúsculas', async () => {
      const { fixture } = await renderSidebar('ADMIN');
      press(fixture, { key: 'S', metaKey: true });
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
    });

    it.each([
      ['sin Ctrl', { key: 's' }],
      ['otra tecla', { key: 'd', ctrlKey: true }],
      ['con Mayús', { key: 's', ctrlKey: true, shiftKey: true }],
      ['con Alt', { key: 's', ctrlKey: true, altKey: true }],
    ])('%s no hace nada ni bloquea el navegador', async (_name, init) => {
      const { fixture } = await renderSidebar('ADMIN');
      const event = press(fixture, init);
      expect(event.defaultPrevented).toBe(false);
      expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
    });

    it('el botón de contraer anuncia el atajo', async () => {
      await renderSidebar('ADMIN');
      expect(screen.getByRole('button', { name: 'Contraer menú' })).toHaveAttribute('aria-keyshortcuts', 'Control+S Meta+S');
    });

    it('ya no existe la opción de ocultar el menú automáticamente', async () => {
      await renderSidebar('ADMIN');
      expect(screen.queryByRole('button', { name: /ocultar menú/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument();
    });
  });

  describe('insignia de alertas', () => {
    it('muestra cuántas alertas activas hay junto a "Alertas" y lo anuncia en su nombre accesible', async () => {
      alertTotal.set(7);
      await renderSidebar('ADMIN');
      const link = screen.getByRole('link', { name: 'Alertas, 7 activas' });
      expect(link).toHaveTextContent('7');
    });

    it('con una sola alerta lo dice en singular', async () => {
      alertTotal.set(1);
      await renderSidebar('ADMIN');
      expect(screen.getByRole('link', { name: 'Alertas, 1 activa' })).toBeInTheDocument();
    });

    it('sin alertas no muestra insignia y el nombre queda limpio', async () => {
      await renderSidebar('ADMIN');
      expect(screen.getByRole('link', { name: 'Alertas' })).toHaveTextContent(/^\s*Alertas\s*$/);
    });

    it('más de 99 se resume como "99+"', async () => {
      alertTotal.set(150);
      await renderSidebar('ADMIN');
      expect(screen.getByRole('link', { name: 'Alertas, 150 activas' })).toHaveTextContent('99+');
    });

    it('con el menú contraído la insignia sigue visible sobre el icono', async () => {
      alertTotal.set(4);
      localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
      await renderSidebar('ADMIN');
      const link = screen.getByRole('link', { name: 'Alertas, 4 activas' });
      expect(link).toHaveTextContent('4');
      expect(link).not.toHaveTextContent('Alertas');
    });

    it('solo "Alertas" lleva insignia', async () => {
      alertTotal.set(3);
      await renderSidebar('ADMIN');
      expect(screen.getByRole('link', { name: 'Inventario' })).not.toHaveTextContent('3');
    });
  });

  describe('descripciones (tooltip)', () => {
    it('enfocar un enlace explica para qué sirve esa pantalla, sin repetir su nombre', async () => {
      await renderSidebar('ADMIN');
      const link = screen.getByRole('link', { name: 'Traslados' });
      link.focus();
      const tip = await screen.findByRole('tooltip');
      expect(tip).toHaveTextContent('Pedir, aprobar, despachar y recibir mercancía entre sucursales.');
      expect(tip.textContent).not.toMatch(/^Traslados/);
      expect(link).toHaveAttribute('aria-describedby', tip.id);
    });

    it('con el menú contraído la descripción empieza por el nombre (no se ve en pantalla)', async () => {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true');
      await renderSidebar('ADMIN');
      screen.getByRole('link', { name: 'Inventario' }).focus();
      const tip = await screen.findByRole('tooltip');
      expect(tip.textContent?.startsWith('Inventario')).toBe(true);
      expect(tip).toHaveTextContent('kardex');
    });

    it('la descripción de Alertas dice cuántas hay activas', async () => {
      alertTotal.set(3);
      await renderSidebar('ADMIN');
      screen.getByRole('link', { name: 'Alertas, 3 activas' }).focus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('3 activas ahora.');
    });

    it('cada enlace del menú tiene su propia descripción', async () => {
      await renderSidebar('ADMIN');
      const seen = new Set<string>();
      for (const link of screen.getAllByRole('link')) {
        link.focus();
        const tip = await screen.findByRole('tooltip');
        seen.add(tip.textContent ?? '');
        link.blur();
      }
      expect(seen.size).toBe(screen.getAllByRole('link').length);
    });

    it('los botones del pie también explican qué hacen', async () => {
      await renderSidebar('ADMIN');
      screen.getByRole('button', { name: 'Cerrar sesión' }).focus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Sale de tu cuenta en este equipo.');
    });
  });
  describe('atajos Ctrl + 1…9 para cambiar de pantalla', () => {
    const press = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      document.dispatchEvent(event);
      return event;
    };
    const spyNavigate = () => vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    // La marca de un atajo anterior puede seguir puesta (se retira con un temporizador): cada prueba parte limpia.
    beforeEach(() => document.documentElement.removeAttribute('data-nav-instant'));

    it('Ctrl + n va a la n-ésima pantalla del menú, en el orden en que se ve, y evita el cambio de pestaña', async () => {
      await renderSidebar('ADMIN');
      const navigate = spyNavigate();
      const first = press({ key: '1', ctrlKey: true });
      expect(first.defaultPrevented).toBe(true);
      expect(navigate).toHaveBeenLastCalledWith('/dashboard');
      press({ key: '4', ctrlKey: true });
      expect(navigate).toHaveBeenLastCalledWith('/transfers');
      press({ key: '7', ctrlKey: true });
      expect(navigate).toHaveBeenLastCalledWith('/sales/history');
    });

    it('mientras dura el cambio de pantalla por atajo el documento queda marcado (sin fundido en las secciones) y la marca se retira sola', async () => {
      await renderSidebar('ADMIN');
      spyNavigate();
      expect(document.documentElement).not.toHaveAttribute('data-nav-instant');
      press({ key: '4', ctrlKey: true });
      expect(document.documentElement).toHaveAttribute('data-nav-instant');
      await vi.waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-nav-instant'), { timeout: 2000 });
    });

    it('también con ⌘ (Mac)', async () => {
      await renderSidebar('ADMIN');
      const navigate = spyNavigate();
      press({ key: '2', metaKey: true });
      expect(navigate).toHaveBeenLastCalledWith('/inventory');
    });

    it('la numeración sigue el menú de cada rol: sin pantalla en ese número, no hace nada ni bloquea la tecla', async () => {
      await renderSidebar('OPERADOR_INVENTARIO'); // 8 pantallas: sin Reportes ni administración
      const navigate = spyNavigate();
      press({ key: '8', ctrlKey: true });
      expect(navigate).toHaveBeenLastCalledWith('/returns');
      navigate.mockClear();
      const ninth = press({ key: '9', ctrlKey: true });
      expect(navigate).not.toHaveBeenCalled();
      expect(ninth.defaultPrevented).toBe(false);
    });

    it.each([
      ['sin Ctrl', { key: '1' }],
      ['con Mayús', { key: '1', ctrlKey: true, shiftKey: true }],
      ['con Alt', { key: '1', ctrlKey: true, altKey: true }],
      ['con el 0', { key: '0', ctrlKey: true }],
    ] as const)('se ignora %s', async (_name, init) => {
      await renderSidebar('ADMIN');
      const navigate = spyNavigate();
      const event = press(init);
      expect(navigate).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('los enlaces con atajo lo anuncian (tooltip y aria-keyshortcuts) y los demás no', async () => {
      await renderSidebar('ADMIN');
      const transfers = screen.getByRole('link', { name: 'Traslados' });
      expect(transfers).toHaveAttribute('aria-keyshortcuts', 'Control+4');
      transfers.focus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Atajo: Ctrl + 4');
      expect(screen.getByRole('link', { name: 'Usuarios' })).not.toHaveAttribute('aria-keyshortcuts'); // la 11.ª: sin atajo
    });
  });
});
