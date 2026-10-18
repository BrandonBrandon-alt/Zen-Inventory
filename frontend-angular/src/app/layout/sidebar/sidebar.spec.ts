import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/session/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { BranchLabelApi } from '../data-access/branch-label-api';
import {
  SIDEBAR_AUTOHIDE_STORAGE_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
} from '../sidebar-state';
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

    it('mientras se arrastra se marca el menú como "redimensionando" (sin animación de ancho)', async () => {
      const { container } = await renderSidebar('ADMIN');
      expect(aside(container)).toHaveClass('transition-[width]');
      fireEvent.pointerDown(handle(), { clientX: 240, pointerId: 1, button: 0 });
      expect(aside(container)).not.toHaveClass('transition-[width]');
      fireEvent.pointerUp(handle(), { pointerId: 1 });
      expect(aside(container)).toHaveClass('transition-[width]');
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

  describe('ocultar automáticamente', () => {
    const host = (container: Element) => container as HTMLElement;
    const panel = (container: Element) => container.querySelector('aside') as HTMLElement;
    const hidden = (container: Element) => panel(container).classList.contains('-translate-x-full');

    // Los eventos del documento no pasan por Testing Library: tras cada uno se actualiza la vista a mano.
    let refresh = (): void => undefined;
    async function renderHidden() {
      localStorage.setItem(SIDEBAR_AUTOHIDE_STORAGE_KEY, 'true');
      const result = await renderSidebar('ADMIN');
      refresh = () => result.fixture.detectChanges();
      return result;
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('activarlo desde el menú lo esconde y lo recuerda', async () => {
      vi.useRealTimers();
      const { container } = await renderSidebar('ADMIN');
      expect(hidden(container)).toBe(false);
      await userEvent.click(screen.getByRole('button', { name: 'Ocultar menú automáticamente' }));
      expect(localStorage.getItem(SIDEBAR_AUTOHIDE_STORAGE_KEY)).toBe('true');
      expect(hidden(container)).toBe(true);
    });

    it('oculto no empuja el contenido: queda fijo sobre él y solo mide la franja del borde', async () => {
      const { container } = await renderHidden();
      expect(host(container).className).toContain('md:fixed');
      expect(host(container).className).not.toContain('md:sticky');
      expect(host(container)).toHaveStyle({ width: '10px' });
      expect(hidden(container)).toBe(true);
    });

    it('esconde el menú también a los lectores de pantalla y al teclado (invisible) hasta que se abre', async () => {
      const { container } = await renderHidden();
      expect(panel(container)).toHaveClass('invisible');
    });

    it('al acercar el puntero se abre al instante, a su ancho y con sombra', async () => {
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      expect(hidden(container)).toBe(false);
      expect(panel(container)).not.toHaveClass('invisible');
      expect(panel(container)).toHaveClass('shadow-2xl');
      expect(host(container)).toHaveStyle({ width: '240px' });
    });

    it('al sacar el puntero se esconde tras una breve espera, no de golpe', async () => {
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      fireEvent.mouseLeave(host(container));
      vi.advanceTimersByTime(300);
      expect(hidden(container)).toBe(false);
      vi.advanceTimersByTime(100);
      expect(hidden(container)).toBe(true);
    });

    it('volver a entrar antes de que pase la espera cancela el cierre', async () => {
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      fireEvent.mouseLeave(host(container));
      vi.advanceTimersByTime(200);
      fireEvent.mouseEnter(host(container));
      vi.advanceTimersByTime(1000);
      expect(hidden(container)).toBe(false);
    });

    it('con el teclado: la franja del borde se enfoca, abre el menú y Escape lo cierra', async () => {
      const { container } = await renderHidden();
      const opener = screen.getByRole('button', { name: 'Abrir menú' });
      expect(opener).toHaveAttribute('aria-expanded', 'false');
      fireEvent.focusIn(opener);
      expect(hidden(container)).toBe(false);
      expect(opener).toHaveAttribute('aria-expanded', 'true');
      fireEvent.keyDown(host(container), { key: 'Escape' });
      expect(hidden(container)).toBe(true);
    });

    it('mover el foco entre los enlaces del menú no lo cierra; sacarlo fuera sí', async () => {
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      const link = screen.getByRole('link', { name: 'Inventario' });
      fireEvent.focusOut(link, { relatedTarget: screen.getByRole('link', { name: 'Alertas' }) });
      vi.advanceTimersByTime(1000);
      expect(hidden(container)).toBe(false);
      fireEvent.focusOut(link, { relatedTarget: document.body });
      vi.advanceTimersByTime(400);
      expect(hidden(container)).toBe(true);
    });

    it('mientras se arrastra el borde para cambiar el ancho no se esconde', async () => {
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      fireEvent.pointerDown(screen.getByRole('separator'), { clientX: 240, pointerId: 1, button: 0 });
      fireEvent.mouseLeave(host(container));
      vi.advanceTimersByTime(1000);
      expect(hidden(container)).toBe(false);
    });

    it('en modo oculto no hay botón de contraer ni modo compacto, y "Fijar menú" lo devuelve a la barra fija', async () => {
      vi.useRealTimers();
      localStorage.setItem(SIDEBAR_STORAGE_KEY, 'true'); // estaba colapsado: oculto se ve completo igual
      const { container } = await renderHidden();
      fireEvent.mouseEnter(host(container));
      expect(screen.queryByRole('button', { name: 'Expandir menú' })).not.toBeInTheDocument();
      expect(screen.getByText('Inventario')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Fijar menú' }));
      expect(host(container).className).toContain('md:sticky');
      expect(localStorage.getItem(SIDEBAR_AUTOHIDE_STORAGE_KEY)).toBe('false');
    });

    it('en modo fijo no hay franja de apertura', async () => {
      vi.useRealTimers();
      await renderSidebar('ADMIN');
      expect(screen.queryByRole('button', { name: 'Abrir menú' })).not.toBeInTheDocument();
    });

    describe('atajo Ctrl + S', () => {
      const press = (init: KeyboardEventInit = { key: 's', ctrlKey: true }) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        document.dispatchEvent(event);
        refresh();
        return event;
      };

      it('con el menú oculto lo abre y lo cierra, y evita el "Guardar página" del navegador', async () => {
        const { container } = await renderHidden();
        const first = press();
        expect(first.defaultPrevented).toBe(true);
        expect(hidden(container)).toBe(false);
        press();
        expect(hidden(container)).toBe(true);
      });

      it('también con ⌘ + S y sin distinguir mayúsculas', async () => {
        const { container } = await renderHidden();
        press({ key: 'S', metaKey: true });
        expect(hidden(container)).toBe(false);
      });

      it('abierto con el atajo se queda abierto aunque el puntero salga', async () => {
        const { container } = await renderHidden();
        press();
        fireEvent.mouseEnter(host(container));
        fireEvent.mouseLeave(host(container));
        vi.advanceTimersByTime(2000);
        expect(hidden(container)).toBe(false);
      });

      it('abierto con el atajo se cierra con Escape o al pulsar fuera, pero no al pulsar dentro', async () => {
        const { container } = await renderHidden();
        press();
        fireEvent.pointerDown(screen.getByRole('link', { name: 'Inventario' }));
        expect(hidden(container)).toBe(false);
        fireEvent.pointerDown(document.body);
        expect(hidden(container)).toBe(true);
        press();
        fireEvent.keyDown(host(container), { key: 'Escape' });
        expect(hidden(container)).toBe(true);
      });

      it('con el menú fijo contrae y expande a iconos', async () => {
        vi.useRealTimers();
        const { fixture } = await renderSidebar('ADMIN');
        refresh = () => fixture.detectChanges();
        press();
        expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');
        press();
        expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('false');
      });

      it.each([
        ['sin Ctrl', { key: 's' }],
        ['otra tecla', { key: 'd', ctrlKey: true }],
        ['con Mayús', { key: 's', ctrlKey: true, shiftKey: true }],
        ['con Alt', { key: 's', ctrlKey: true, altKey: true }],
      ])('%s no hace nada ni bloquea el navegador', async (_name, init) => {
        const { container } = await renderHidden();
        const event = press(init);
        expect(event.defaultPrevented).toBe(false);
        expect(hidden(container)).toBe(true);
      });

      it('al abrirse, los enlaces entran en cascada (animación) y al cerrarse la pierden', async () => {
        await renderHidden();
        const link = () => screen.getByRole('link', { name: 'Inventario' }).closest('li') as HTMLElement;
        expect(link()).not.toHaveClass('animate-nav-in');
        press();
        expect(link()).toHaveClass('animate-nav-in');
        expect(link().style.getPropertyValue('--i')).not.toBe('');
        press();
        expect(link()).not.toHaveClass('animate-nav-in');
      });

      it('sale más rápido de lo que entra', async () => {
        const { container } = await renderHidden();
        expect(panel(container)).toHaveClass('duration-200');
        press();
        expect(panel(container)).toHaveClass('duration-300');
      });

      it('anuncia el atajo en el botón de apertura', async () => {
        await renderHidden();
        expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-keyshortcuts', 'Control+S Meta+S');
      });
    });
  });
});
