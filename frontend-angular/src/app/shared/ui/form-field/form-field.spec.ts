import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormField, InputDirective } from './form-field';

const imports = [FormField, InputDirective];

describe('FormField', () => {
  it('asocia la etiqueta con el input (se puede localizar por su etiqueta)', async () => {
    await render('<app-form-field label="Correo"><input appInput /></app-form-field>', { imports });
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
  });

  it('sin error no marca el input como inválido ni muestra alertas', async () => {
    await render('<app-form-field label="Correo"><input appInput /></app-form-field>', { imports });
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con error muestra el mensaje como alerta y marca el input inválido describiéndolo', async () => {
    await render(
      '<app-form-field label="Correo" error="Correo inválido."><input appInput /></app-form-field>',
      { imports },
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Correo inválido.');
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('dos campos tienen ids distintos', async () => {
    await render(
      `<app-form-field label="Uno"><input appInput /></app-form-field>
       <app-form-field label="Dos"><input appInput /></app-form-field>`,
      { imports },
    );
    expect(screen.getByLabelText('Uno').id).not.toBe(screen.getByLabelText('Dos').id);
  });

  it('también sirve para un <select>: etiqueta asociada y error accesible', async () => {
    await render(
      '<app-form-field label="Rol" error="Elige un rol"><select appInput><option value="1">Admin</option></select></app-form-field>',
      { imports },
    );
    const select = screen.getByLabelText('Rol');
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Elige un rol');
  });

  it('un input sin FormField sigue funcionando', async () => {
    await render('<input appInput aria-label="Suelto" />', { imports });
    expect(screen.getByLabelText('Suelto')).toBeInTheDocument();
  });

  it('proyecta los slots de prefijo y sufijo', async () => {
    await render(
      `<app-form-field label="Clave">
         <span data-slot="prefix">P</span>
         <input appInput />
         <span data-slot="suffix">S</span>
       </app-form-field>`,
      { imports },
    );
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('el mensaje de error entra con animación', async () => {
    await render('<app-form-field label="Correo" error="Correo inválido."><input appInput /></app-form-field>', { imports });
    expect(screen.getByRole('alert')).toHaveClass('animate-error-in');
  });
});

describe('FormField — campo numérico', () => {
  const field = (attrs: string) => `<app-form-field label="Cantidad"><input appInput type="number" ${attrs} /></app-form-field>`;
  const input = () => screen.getByLabelText('Cantidad') as HTMLInputElement;
  const more = () => screen.getByRole('button', { name: 'Aumentar' });
  const less = () => screen.getByRole('button', { name: 'Disminuir' });

  it('muestra los botones − y +; un campo de texto no los tiene', async () => {
    await render(field('step="1"'), { imports });
    expect(more()).toBeInTheDocument();
    expect(less()).toBeInTheDocument();
  });

  it('un campo de texto o de contraseña no muestra botones', async () => {
    await render('<app-form-field label="Nombre"><input appInput type="text" /></app-form-field>', { imports });
    expect(screen.queryByRole('button', { name: 'Aumentar' })).not.toBeInTheDocument();
  });

  it('los botones no reciben foco con Tab (el teclado usa las flechas del propio campo)', async () => {
    await render(field('step="1"'), { imports });
    expect(more()).toHaveAttribute('tabindex', '-1');
  });

  it('+ y − mueven el valor un paso', async () => {
    await render(field('step="5" value="10"'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('15');
    await userEvent.click(less());
    await userEvent.click(less());
    expect(input().value).toBe('5');
  });

  it('sin step o con step="any" avanza de 1 en 1', async () => {
    await render(field('step="any" value="2"'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('3');
  });

  it('con decimales no acumula error de coma flotante (0.1 + 0.2 = 0.3)', async () => {
    await render(field('step="0.1" value="0.2"'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('0.3');
  });

  it('un campo vacío parte de 0, y respeta el mínimo', async () => {
    await render(field('min="1" step="1"'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('1');
    await userEvent.click(less());
    await userEvent.click(less());
    expect(input().value).toBe('1'); // no baja de min
  });

  it('respeta el máximo', async () => {
    await render(field('max="3" step="2" value="2"'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('3');
    await userEvent.click(more());
    expect(input().value).toBe('3');
  });

  it('avisa con un evento input para que el formulario se entere', async () => {
    const onInput = vi.fn();
    await render(`<app-form-field label="Cantidad"><input appInput type="number" step="1" value="1" (input)="onInput()" /></app-form-field>`, {
      imports,
      componentProperties: { onInput },
    });
    await userEvent.click(more());
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('con el campo deshabilitado los botones no cambian nada', async () => {
    await render(field('step="1" value="4" disabled'), { imports });
    await userEvent.click(more());
    expect(input().value).toBe('4');
  });

  describe('mantener pulsado', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('repite el paso mientras se mantiene el botón y se detiene al soltar', async () => {
      await render(field('step="1" value="0"'), { imports });
      const button = more();
      button.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }));
      expect(input().value).toBe('1'); // el primer paso es inmediato
      vi.advanceTimersByTime(400 + 70 * 3);
      expect(Number(input().value)).toBeGreaterThanOrEqual(4);
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const stopped = input().value;
      vi.advanceTimersByTime(1000);
      expect(input().value).toBe(stopped);
    });
  });
});
