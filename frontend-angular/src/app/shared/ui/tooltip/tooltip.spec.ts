import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeTooltipPosition, resetTooltipGroup, Tooltip } from './tooltip';

const HOST = '<button [appTooltip]="text" tooltipDelay="0" aria-label="Ajustar">i</button><button>otro</button>';

async function setup(text = 'Ajustar existencias') {
  await render(HOST, { imports: [Tooltip], componentProperties: { text } });
  return screen.getByRole('button', { name: 'Ajustar' });
}

describe('Tooltip', () => {
  beforeEach(() => resetTooltipGroup());

  it('la primera descripción de un recorrido entra animada; la que sigue enseguida sale al instante y sin animación', async () => {
    await render('<button [appTooltip]="\'Uno\'" tooltipDelay="0" aria-label="A">a</button><button [appTooltip]="\'Dos\'" tooltipDelay="400" aria-label="B">b</button>', { imports: [Tooltip] });
    const a = screen.getByRole('button', { name: 'A' });
    const b = screen.getByRole('button', { name: 'B' });
    await userEvent.hover(a);
    const first = await screen.findByRole('tooltip');
    expect(first).toHaveClass('animate-error-in');
    await userEvent.unhover(a);
    await userEvent.hover(b); // su espera propia es de 400 ms, pero vienes de otra descripción: sin espera
    const second = await screen.findByRole('tooltip', undefined, { timeout: 200 });
    expect(second).toHaveTextContent('Dos');
    expect(second).not.toHaveClass('animate-error-in');
  });

  it('al pasar el cursor muestra la descripción y al salir la oculta', async () => {
    const button = await setup();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(button);
    await vi.waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Ajustar existencias'));
    await userEvent.unhover(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('con el teclado aparece al enfocar y desaparece al perder el foco', async () => {
    const button = await setup();
    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ajustar existencias');
    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('el elemento queda descrito por la descripción mientras se muestra, y deja de estarlo después', async () => {
    const button = await setup();
    expect(button).not.toHaveAttribute('aria-describedby');
    await userEvent.tab();
    expect(button).toHaveAccessibleDescription('Ajustar existencias');
    await userEvent.tab();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('Escape la oculta sin propagarse al resto de la página (no cierra un modal)', async () => {
    await setup();
    await userEvent.tab();
    const outer = vi.fn(); // se registra después del Tab: solo importa lo que ocurra con Escape
    document.addEventListener('keydown', outer);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });

  it('sin descripción visible, Escape sigue su camino', async () => {
    await setup();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    screen.getByRole('button', { name: 'otro' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(outer).toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });

  it('con texto vacío no se muestra nada', async () => {
    const button = await setup('');
    await userEvent.hover(button);
    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('la espera al pasar el cursor se respeta: no aparece de inmediato', async () => {
    await render('<button [appTooltip]="text" tooltipDelay="300" aria-label="X">i</button>', { imports: [Tooltip], componentProperties: { text: 'Hola' } });
    await userEvent.hover(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
  });

  it('al destruir el componente la descripción se retira del documento', async () => {
    await render('<button [appTooltip]="text" tooltipDelay="0" aria-label="X">i</button>', { imports: [Tooltip], componentProperties: { text: 'Hola' } }).then(async ({ fixture }) => {
      await userEvent.tab();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      fixture.destroy();
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('computeTooltipPosition', () => {
  const viewport = { width: 1000, height: 800 };
  const tip = { width: 120, height: 30 };

  it('por defecto va encima y centrada', () => {
    const r = computeTooltipPosition({ top: 400, left: 500, width: 40, height: 40 }, tip, viewport, 'top');
    expect(r).toEqual({ placement: 'top', top: 400 - 8 - 30, left: 500 + 20 - 60 });
  });

  it('si encima no cabe, pasa abajo', () => {
    const r = computeTooltipPosition({ top: 10, left: 500, width: 40, height: 40 }, tip, viewport, 'top');
    expect(r.placement).toBe('bottom');
    expect(r.top).toBe(10 + 40 + 8);
  });

  it('si se pide abajo y no cabe, pasa arriba', () => {
    const r = computeTooltipPosition({ top: 770, left: 500, width: 40, height: 40 }, tip, viewport, 'bottom');
    expect(r.placement).toBe('top');
  });

  it('no se sale por los lados de la ventana', () => {
    expect(computeTooltipPosition({ top: 400, left: 0, width: 20, height: 20 }, tip, viewport, 'top').left).toBe(8);
    expect(computeTooltipPosition({ top: 400, left: 990, width: 20, height: 20 }, tip, viewport, 'top').left).toBe(1000 - 120 - 8);
  });

  describe('a los lados', () => {
    const side = { width: 200, height: 60 };

    it('a la derecha va junto al elemento y centrada en vertical', () => {
      const r = computeTooltipPosition({ top: 300, left: 20, width: 180, height: 40 }, side, viewport, 'right');
      expect(r).toEqual({ placement: 'right', left: 20 + 180 + 8, top: 300 + 20 - 30 });
    });

    it('si a la derecha no cabe, pasa a la izquierda', () => {
      const r = computeTooltipPosition({ top: 300, left: 850, width: 140, height: 40 }, side, viewport, 'right');
      expect(r.placement).toBe('left');
      expect(r.left).toBe(850 - 8 - 200);
    });

    it('a la izquierda, si no cabe, pasa a la derecha', () => {
      const r = computeTooltipPosition({ top: 300, left: 10, width: 40, height: 40 }, side, viewport, 'left');
      expect(r.placement).toBe('right');
    });

    it('no se sale por arriba ni por abajo de la ventana', () => {
      expect(computeTooltipPosition({ top: 0, left: 20, width: 100, height: 20 }, side, viewport, 'right').top).toBe(8);
      expect(computeTooltipPosition({ top: 790, left: 20, width: 100, height: 20 }, side, viewport, 'right').top).toBe(800 - 60 - 8);
    });

    it('si no cabe en ningún lado, se queda en el pedido', () => {
      const r = computeTooltipPosition({ top: 300, left: 10, width: 980, height: 40 }, { width: 400, height: 60 }, viewport, 'right');
      expect(r.placement).toBe('right');
    });
  });

  it('si no cabe ni arriba ni abajo, se queda en el lado pedido', () => {
    const r = computeTooltipPosition({ top: 20, left: 500, width: 40, height: 760 }, tip, viewport, 'top');
    expect(r.placement).toBe('top');
  });
});
