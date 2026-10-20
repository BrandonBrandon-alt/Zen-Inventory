import { Component, signal } from '@angular/core';
import { LucidePackage } from '@lucide/angular';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type TabItem, Tabs } from './tabs';

const TABS: TabItem[] = [
  { id: 'stock', label: 'Existencias', icon: LucidePackage.icon },
  { id: 'kardex', label: 'Kardex' },
  { id: 'otros', label: 'Otros' },
];

@Component({
  imports: [Tabs],
  template: `<app-tabs [tabs]="tabs" [(active)]="active" idPrefix="inv" ariaLabel="Secciones" />`,
})
class Host {
  tabs = TABS;
  active = signal('stock');
}

async function setup() {
  const result = await render(Host);
  return { host: result.fixture.componentInstance, ...result };
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('es una lista de pestañas con nombre y marca la activa', async () => {
    await setup();
    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
    expect(tab('Existencias')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Kardex')).toHaveAttribute('aria-selected', 'false');
  });

  it('solo la pestaña activa entra en el orden de tabulación', async () => {
    await setup();
    expect(tab('Existencias')).toHaveAttribute('tabindex', '0');
    expect(tab('Kardex')).toHaveAttribute('tabindex', '-1');
  });

  it('cada pestaña declara su panel con los ids acordados', async () => {
    await setup();
    expect(tab('Kardex')).toHaveAttribute('id', 'inv-tab-kardex');
    expect(tab('Kardex')).toHaveAttribute('aria-controls', 'inv-panel-kardex');
  });

  it('un clic cambia la pestaña activa y actualiza el modelo del padre', async () => {
    const { host } = await setup();
    await userEvent.click(tab('Kardex'));
    expect(host.active()).toBe('kardex');
    expect(tab('Kardex')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Existencias')).toHaveAttribute('aria-selected', 'false');
  });

  it('las flechas cambian de pestaña dando la vuelta en los extremos, y mueven el foco', async () => {
    const { host } = await setup();
    tab('Existencias').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(host.active()).toBe('kardex');
    expect(tab('Kardex')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(host.active()).toBe('otros');
    await userEvent.keyboard('{ArrowRight}');
    expect(host.active()).toBe('stock');
  });

  it('Inicio y Fin saltan a la primera y a la última', async () => {
    const { host } = await setup();
    tab('Existencias').focus();
    await userEvent.keyboard('{End}');
    expect(host.active()).toBe('otros');
    await userEvent.keyboard('{Home}');
    expect(host.active()).toBe('stock');
  });

  it('dibuja el icono de la pestaña que lo trae', async () => {
    await setup();
    expect(tab('Existencias').querySelector('svg')).not.toBeNull();
    expect(tab('Kardex').querySelector('svg')).toBeNull();
  });

  describe('línea de la pestaña activa', () => {
    const LEFT: Record<string, number> = { 'inv-tab-stock': 0, 'inv-tab-kardex': 120, 'inv-tab-otros': 240 };
    afterEach(() => vi.restoreAllMocks());

    function measureLikeALayout() {
      vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
        return LEFT[this.id] ?? 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.getAttribute('role') === 'tab' ? 100 : 0;
      });
    }
    const line = (container: Element) => container.querySelector('[role="tablist"] > span[aria-hidden="true"]') as HTMLElement;

    it('se coloca bajo la pestaña activa y se desliza a la que se elige', async () => {
      measureLikeALayout();
      const { container } = await setup();
      expect(line(container).style.transform).toBe('translateX(0px)');
      expect(line(container).style.width).toBe('100px');
      await userEvent.click(tab('Kardex'));
      expect(line(container).style.transform).toBe('translateX(120px)');
    });

    it('la primera colocación no se anima (no cruza desde el borde); las siguientes sí', async () => {
      measureLikeALayout();
      const { container } = await setup();
      await vi.waitFor(() => expect(line(container).className).toContain('transition-[transform,width]'));
    });

    it('no estorba al teclado ni a los lectores de pantalla', async () => {
      const { container } = await setup();
      expect(line(container)).toHaveAttribute('aria-hidden', 'true');
      expect(line(container)).toHaveClass('pointer-events-none');
    });
  });
});
