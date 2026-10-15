import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('muestra su contenido y está habilitado por defecto', async () => {
    await render('<button appButton>Guardar</button>', { imports: [Button] });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('dispara el clic cuando está habilitado', async () => {
    const onClick = vi.fn();
    await render('<button appButton (click)="onClick()">Guardar</button>', {
      imports: [Button],
      componentProperties: { onClick },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('con loading queda deshabilitado, ocupado, muestra el spinner y no dispara el clic', async () => {
    const onClick = vi.fn();
    await render('<button appButton [loading]="true" (click)="onClick()">Guardar</button>', {
      imports: [Button],
      componentProperties: { onClick },
    });
    const button = screen.getByRole('button', { name: /Guardar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sin loading no muestra spinner ni aria-busy', async () => {
    await render('<button appButton>Guardar</button>', { imports: [Button] });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
  });

  it('con disabled queda deshabilitado', async () => {
    await render('<button appButton [disabled]="true">Guardar</button>', { imports: [Button] });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it.each([
    ['primary', 'bg-primary'],
    ['ghost', 'bg-transparent'],
    ['danger', 'text-danger'],
  ])('la variante %s aplica su estilo', async (variant, expectedClass) => {
    await render(`<button appButton variant="${variant}">X</button>`, { imports: [Button] });
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('fullWidth ocupa todo el ancho', async () => {
    await render('<button appButton fullWidth>X</button>', { imports: [Button] });
    expect(screen.getByRole('button')).toHaveClass('w-full');
  });

  it('al pulsarlo se hunde ligeramente (solo si está habilitado)', async () => {
    await render('<button appButton>Guardar</button>', { imports: [Button] });
    expect(screen.getByRole('button')).toHaveClass('enabled:active:scale-[0.98]');
  });
});
