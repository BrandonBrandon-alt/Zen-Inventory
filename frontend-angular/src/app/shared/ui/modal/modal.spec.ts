import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../button/button';
import { Modal } from './modal';

const imports = [Modal, Button];

const TEMPLATE = `
  <app-modal
    [(open)]="open"
    title="Nueva sucursal"
    [description]="description"
    [size]="size"
    [dismissible]="dismissible"
    (closed)="onClosed()"
  >
    <p>Contenido del formulario</p>
    <div data-slot="footer">
      <button appButton variant="ghost" (click)="open = false">Cancelar</button>
      <button appButton>Guardar</button>
    </div>
  </app-modal>`;

type Props = Partial<{
  open: boolean;
  description: string | undefined;
  size: 'sm' | 'md' | 'lg';
  dismissible: boolean;
}>;

async function setup(props: Props = {}) {
  const componentProperties = {
    open: true,
    description: undefined as string | undefined,
    size: 'md' as const,
    dismissible: true,
    onClosed: vi.fn(),
    ...props,
  };
  const result = await render(TEMPLATE, { imports, componentProperties });
  const host = result.fixture.componentInstance as unknown as typeof componentProperties;
  const dialog = () => result.container.querySelector('dialog') as HTMLDialogElement;
  const rerenderWith = async (changes: Partial<typeof componentProperties>) => {
    Object.assign(host, changes);
    result.fixture.detectChanges();
    await result.fixture.whenStable();
  };
  return { ...result, host, dialog, rerenderWith, onClosed: componentProperties.onClosed };
}

/** Escape en un navegador real: dispara `cancel` y, si nadie lo impide, cierra el diálogo. */
function pressEscape(dialog: HTMLDialogElement): void {
  const cancel = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(cancel);
  if (!cancel.defaultPrevented) dialog.close();
}

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  describe('apertura y contenido', () => {
    it('cerrado no es accesible: no hay diálogo en el árbol de accesibilidad', async () => {
      await setup({ open: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('abierto es un diálogo con el título como nombre accesible', async () => {
      await setup();
      expect(screen.getByRole('dialog', { name: 'Nueva sucursal' })).toBeInTheDocument();
    });

    it('lo abre con showModal() (modal nativo: foco atrapado y resto de la página inerte), una sola vez', async () => {
      const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      await setup();
      expect(showModal).toHaveBeenCalledTimes(1);
    });

    it('muestra el contenido y el pie proyectados', async () => {
      await setup();
      expect(screen.getByText('Contenido del formulario')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });

    it('la descripción es opcional y, si existe, describe el diálogo', async () => {
      await setup({ description: 'Completa los datos de la sucursal.' });
      const dialog = screen.getByRole('dialog');
      expect(screen.getByText('Completa los datos de la sucursal.')).toBeInTheDocument();
      expect(dialog).toHaveAccessibleDescription('Completa los datos de la sucursal.');
    });

    it('sin descripción no declara aria-describedby', async () => {
      await setup();
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
    });

    it('sin pie proyectado no dibuja el pie vacío', async () => {
      const { container } = await render('<app-modal [open]="true" title="Aviso"><p>Hola</p></app-modal>', { imports });
      expect(container.querySelector('footer')?.children.length).toBe(0);
      expect(container.querySelector('footer')).toBeEmptyDOMElement();
    });

    it.each([
      ['sm', 'max-w-sm'],
      ['md', 'max-w-lg'],
      ['lg', 'max-w-2xl'],
    ] as const)('el tamaño %s limita el ancho a %s', async (size, cls) => {
      await setup({ size });
      expect(screen.getByRole('dialog')).toHaveClass(cls);
    });
  });

  describe('apertura y cierre desde el padre', () => {
    it('se abre y se cierra al cambiar `open`, y se puede reabrir', async () => {
      const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
      const { rerenderWith } = await setup({ open: false });
      expect(showModal).not.toHaveBeenCalled();

      await rerenderWith({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await rerenderWith({ open: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(close).toHaveBeenCalledTimes(1);

      await rerenderWith({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(showModal).toHaveBeenCalledTimes(2);
    });

    it('cerrarlo desde el padre NO emite `closed` (solo lo hacen las acciones del usuario)', async () => {
      const { rerenderWith, onClosed } = await setup();
      await rerenderWith({ open: false });
      expect(onClosed).not.toHaveBeenCalled();
    });

    it('un botón del propio contenido puede cerrarlo (Cancelar) y se refleja en `open` y en `closed`', async () => {
      const { host, onClosed } = await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(host.open).toBe(false);
      expect(onClosed).not.toHaveBeenCalled();
    });
  });

  describe('cierre por el usuario', () => {
    it('el botón de cerrar (X) lo cierra, actualiza `open` y emite `closed` una vez', async () => {
      const { host, onClosed } = await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(host.open).toBe(false);
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('Escape lo cierra y emite `closed`', async () => {
      const { dialog, host, onClosed } = await setup();
      pressEscape(dialog());
      expect(host.open).toBe(false);
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('pulsar el fondo (fuera del cuadro) lo cierra', async () => {
      const { dialog, host, onClosed } = await setup();
      await userEvent.click(dialog());
      expect(host.open).toBe(false);
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('pulsar dentro del cuadro NO lo cierra', async () => {
      const { host } = await setup();
      await userEvent.click(screen.getByText('Contenido del formulario'));
      expect(host.open).toBe(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('dismissible = false (p. ej. mientras se guarda)', () => {
    it('no ofrece el botón de cerrar', async () => {
      await setup({ dismissible: false });
      expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
    });

    it('Escape no lo cierra (se cancela el cierre nativo)', async () => {
      const { dialog, host, onClosed } = await setup({ dismissible: false });
      pressEscape(dialog());
      expect(host.open).toBe(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onClosed).not.toHaveBeenCalled();
    });

    it('pulsar el fondo no lo cierra', async () => {
      const { dialog, host } = await setup({ dismissible: false });
      await userEvent.click(dialog());
      expect(host.open).toBe(true);
    });

    it('al volver a ser descartable, Escape vuelve a funcionar', async () => {
      const { dialog, host, rerenderWith } = await setup({ dismissible: false });
      await rerenderWith({ dismissible: true });
      pressEscape(dialog());
      expect(host.open).toBe(false);
    });
  });

  describe('bloqueo del scroll de la página', () => {
    it('mientras está abierto el fondo no se desplaza, y se restaura al cerrar', async () => {
      const { rerenderWith } = await setup({ open: false });
      expect(document.body.style.overflow).toBe('');
      await rerenderWith({ open: true });
      expect(document.body.style.overflow).toBe('hidden');
      await rerenderWith({ open: false });
      expect(document.body.style.overflow).toBe('');
    });

    it('si el modal se destruye estando abierto (p. ej. al navegar), también se restaura', async () => {
      const { fixture } = await setup();
      expect(document.body.style.overflow).toBe('hidden');
      fixture.destroy();
      expect(document.body.style.overflow).toBe('');
    });

    it('con dos modales abiertos el scroll solo se libera al cerrar el último', async () => {
      const { container, fixture } = await render(
        `<app-modal [(open)]="a" title="A"><p>a</p></app-modal><app-modal [(open)]="b" title="B"><p>b</p></app-modal>`,
        { imports, componentProperties: { a: true, b: true } },
      );
      const host = fixture.componentInstance as unknown as { a: boolean; b: boolean };
      expect(container.querySelectorAll('dialog[open]')).toHaveLength(2);
      host.a = false;
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.body.style.overflow).toBe('hidden');
      host.b = false;
      fixture.detectChanges();
      await fixture.whenStable();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
