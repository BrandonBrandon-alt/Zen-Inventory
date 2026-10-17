import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '@core/auth/session/auth-store';
import { BranchLabelApi } from '../data-access/branch-label-api';
import { UserCard } from './user-card';

const provideLabel = (label: string) => [
  { provide: BranchLabelApi, useValue: { labelFor: () => of(label) } },
  provideHttpClient(),
  provideRouter([]),
];

describe('UserCard', () => {
  beforeEach(() => localStorage.clear());

  it('sin sesión no muestra nada', async () => {
    const { container } = await render(UserCard, { providers: provideLabel('Norte') });
    expect(container).toHaveTextContent('');
  });

  it('muestra la inicial, el nombre y la sucursal', async () => {
    await render(UserCard, {
      providers: provideLabel('Sucursal Norte'),
      configureTestBed: (bed) =>
        bed
          .inject(AuthStore)
          .start({ token: 't', email: 'e', nombre: 'ana pérez', rol: 'MANAGER', id: 1, sucursalId: 3 }),
    });
    expect(screen.getByText('AP')).toBeInTheDocument();
    expect(screen.getByText('ana pérez')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi perfil, ana pérez' })).toHaveAttribute('href', '/profile');
    expect(await screen.findByText('Sucursal Norte')).toBeInTheDocument();
  });

  it('sin nombre muestra "?" como inicial', async () => {
    await render(UserCard, {
      providers: provideLabel('Zen Inventory'),
      configureTestBed: (bed) =>
        bed.inject(AuthStore).start({ token: 't', email: 'e', nombre: '', rol: 'MANAGER', id: 1 }),
    });
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('en modo compacto solo muestra la inicial', async () => {
    await render(UserCard, {
      inputs: { compact: true },
      providers: provideLabel('Sucursal Norte'),
      configureTestBed: (bed) =>
        bed
          .inject(AuthStore)
          .start({ token: 't', email: 'e', nombre: 'Ana', rol: 'MANAGER', id: 1, sucursalId: 3 }),
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('Sucursal Norte')).not.toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });
});
