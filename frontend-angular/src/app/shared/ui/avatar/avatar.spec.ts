import { render, screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';
import { Avatar, avatarColor, initials } from './avatar';

describe('initials', () => {
  it.each([
    ['Brandon Montealegre', 'BM'],
    ['ana', 'A'],
    ['  ana   maría   pérez ', 'AP'],
    ['álvaro núñez', 'ÁN'],
    ['juan-carlos', 'J'],
    ['', '?'],
    ['   ', '?'],
    ['123 456', '?'],
    ['3M Industrial', 'MI'],
  ])('%j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('avatarColor', () => {
  it('es estable: el mismo nombre siempre da el mismo color', () => {
    expect(avatarColor('Ana Pérez')).toBe(avatarColor('Ana Pérez'));
  });

  it('no distingue mayúsculas ni espacios de los bordes', () => {
    expect(avatarColor('  ANA pérez ')).toBe(avatarColor('ana pérez'));
  });

  it('nombres distintos dan colores distintos (al menos en estos ejemplos)', () => {
    const colors = new Set(['Ana', 'Luis', 'Marta', 'Brandon', 'Sofía', 'Camilo'].map(avatarColor));
    expect(colors.size).toBeGreaterThan(3);
  });

  it('siempre es un color oscuro y saturado donde el texto blanco se lee', () => {
    for (const name of ['a', 'Zeta', 'Brandon Montealegre', '', '😀']) {
      expect(avatarColor(name)).toMatch(/^hsl\(\d{1,3} 42% 38%\)$/);
    }
  });
});

describe('Avatar', () => {
  it('sin foto muestra las iniciales sobre su color', async () => {
    const { container } = await render(Avatar, { inputs: { name: 'Brandon Montealegre' } });
    expect(screen.getByText('BM')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect((container as HTMLElement).style.backgroundColor).not.toBe('');
  });

  it('con foto la muestra y oculta las iniciales', async () => {
    const { container } = await render(Avatar, { inputs: { name: 'Ana', src: 'blob:x' } });
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:x');
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('si la foto no carga, vuelve a las iniciales', async () => {
    const { container, fixture } = await render(Avatar, { inputs: { name: 'Ana', src: 'blob:roto' } });
    container.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('tras un fallo, una URL nueva se vuelve a intentar', async () => {
    const { container, fixture, rerender } = await render(Avatar, { inputs: { name: 'Ana', src: 'blob:roto' } });
    container.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await rerender({ inputs: { name: 'Ana', src: 'blob:nuevo' } });
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:nuevo');
  });

  it('por defecto es decorativo (el nombre ya está al lado)', async () => {
    const { container } = await render(Avatar, { inputs: { name: 'Ana' } });
    expect(container).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('con decorative=false se anuncia como imagen con el nombre', async () => {
    await render(Avatar, { inputs: { name: 'Ana Pérez', decorative: false } });
    expect(screen.getByRole('img', { name: 'Ana Pérez' })).toBeInTheDocument();
  });

  it.each([
    ['xs', 'size-6'],
    ['md', 'size-9'],
    ['xl', 'size-28'],
  ] as const)('el tamaño %s aplica %s', async (size, expected) => {
    const { container } = await render(Avatar, { inputs: { name: 'Ana', size } });
    expect(container).toHaveClass(expected);
  });
});
