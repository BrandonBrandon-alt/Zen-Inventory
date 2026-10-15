import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { apiErrorBody, okLogin, server, TEST_API } from '@testing/msw-server';
import { LoginPage } from './login-page';

const LOGIN = `${TEST_API}/api/auth/login`;

async function renderLogin() {
  const result = await render(LoginPage, {
    providers: [provideRouter([]), provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  return { ...result, navigate };
}

const emailInput = () => screen.getByLabelText('Correo electrónico');
const passwordInput = () => screen.getByLabelText('Contraseña');
const submitButton = () => screen.getByRole('button', { name: /Ingresar al sistema|Verificando/ });

async function fillValid() {
  await userEvent.type(emailInput(), 'ana@zen.com');
  await userEvent.type(passwordInput(), 'secreto1');
}

describe('LoginPage', () => {
  beforeEach(() => localStorage.clear());

  it('muestra el formulario sin cuentas demo', async () => {
    await renderLogin();
    expect(screen.getByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
    expect(emailInput()).toBeInTheDocument();
    expect(passwordInput()).toHaveAttribute('type', 'password');
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument();
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('el título de marca se anima letra por letra pero sigue leyéndose entero para los lectores de pantalla', async () => {
    await renderLogin();
    const title = screen.getByRole('heading', { level: 1, name: 'Zen Inventory' });
    const letters = Array.from(title.querySelectorAll('span'));
    expect(letters.map((l) => l.textContent).join('')).toBe('Zen Inventory');
    expect(letters).toHaveLength('Zen Inventory'.length);
    // Cada letra es decorativa (el nombre lo da el título) y entra un poco después de la anterior.
    expect(letters.every((l) => l.getAttribute('aria-hidden') === 'true')).toBe(true);
    const delays = letters.map((l) => parseFloat(l.style.animationDelay));
    expect(delays[0]).toBeCloseTo(0.2, 5);
    expect(delays[1]).toBeCloseTo(0.24, 5);
    expect(delays.every((d, i) => i === 0 || d > delays[i - 1])).toBe(true);
  });

  it('el espacio entre palabras del título se conserva', async () => {
    await renderLogin();
    const title = screen.getByRole('heading', { level: 1, name: 'Zen Inventory' });
    const space = Array.from(title.querySelectorAll('span')).find((l) => l.textContent === ' ');
    expect(space).toBeDefined();
    expect(space).toHaveClass('whitespace-pre');
  });

  it('al enviar vacío muestra los errores y no llama al backend', async () => {
    let calls = 0;
    server.use(
      http.post(LOGIN, () => {
        calls++;
        return HttpResponse.json(okLogin);
      }),
    );
    await renderLogin();
    await userEvent.click(submitButton());
    expect(screen.getByText('El correo es requerido.')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida.')).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('valida el formato del correo al salir del campo', async () => {
    await renderLogin();
    await userEvent.type(emailInput(), 'sin-arroba');
    await userEvent.tab();
    expect(screen.getByText('Correo inválido.')).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('valida la longitud mínima de la contraseña', async () => {
    await renderLogin();
    await userEvent.type(passwordInput(), '123');
    await userEvent.tab();
    expect(screen.getByText('Mínimo 6 caracteres.')).toBeInTheDocument();
  });

  it('no muestra errores antes de que el usuario toque el campo', async () => {
    await renderLogin();
    await userEvent.type(emailInput(), 'sin');
    expect(screen.queryByText('Correo inválido.')).not.toBeInTheDocument();
  });

  it('con credenciales válidas inicia sesión y navega al panel', async () => {
    let received: unknown;
    server.use(
      http.post(LOGIN, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(okLogin);
      }),
    );
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'));
    expect(received).toEqual({ email: 'ana@zen.com', password: 'secreto1' });
    expect(TestBed.inject(AuthStore).isAuthenticated()).toBe(true);
  });

  it('con credenciales incorrectas muestra el mensaje del backend y deja reintentar', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 })));
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales incorrectas');
    expect(navigate).not.toHaveBeenCalled();
    expect(emailInput()).toBeEnabled();
    expect(passwordInput()).toHaveValue('secreto1');
  });

  it('muestra el error de servidor con el mensaje del backend', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Código: a1b2c3d4'), { status: 500 }),
      ),
    );
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Código: a1b2c3d4');
  });

  it('una cuenta desactivada muestra el mensaje del backend', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(apiErrorBody(401, 'ACCOUNT_DISABLED', 'La cuenta está desactivada. Por favor, contacte al administrador.'), { status: 401 }),
      ),
    );
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta está desactivada');
  });

  it('si el backend rechaza el formato de un campo, el mensaje aparece bajo ese campo (no en el aviso general)', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', 'email: Formato de email inválido', {
            fieldErrors: [{ field: 'email', message: 'El servidor no acepta este correo' }],
          }),
          { status: 400 },
        ),
      ),
    );
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByText('El servidor no acepta este correo')).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    // Es el mensaje del campo: no hay además un aviso general en el formulario (la única alerta es la del campo).
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('El servidor no acepta este correo');
    // Al corregir el correo el error del servidor desaparece.
    await userEvent.type(emailInput(), 'x');
    expect(screen.queryByText('El servidor no acepta este correo')).not.toBeInTheDocument();
  });

  it('un error de red muestra el aviso en el formulario y no un aviso global duplicado', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.error()));
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar');
  });

  it('el error del servidor desaparece al editar un campo', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 })));
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    await screen.findByRole('alert');
    await userEvent.type(passwordInput(), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('durante el envío deshabilita el formulario y muestra "Verificando…"', async () => {
    server.use(
      http.post(LOGIN, async () => {
        await delay(150);
        return HttpResponse.json(okLogin);
      }),
    );
    await renderLogin();
    await fillValid();
    await userEvent.click(submitButton());
    const busy = await screen.findByRole('button', { name: /Verificando/ });
    expect(busy).toBeDisabled();
    expect(emailInput()).toBeDisabled();
    expect(passwordInput()).toBeDisabled();
  });

  it('un doble clic envía una sola petición', async () => {
    let calls = 0;
    server.use(
      http.post(LOGIN, async () => {
        calls++;
        await delay(150);
        return HttpResponse.json(okLogin);
      }),
    );
    const { navigate } = await renderLogin();
    await fillValid();
    await userEvent.dblClick(submitButton());
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls).toBe(1);
  });

  it('dos envíos consecutivos antes de que la pantalla se actualice envían una sola petición', async () => {
    let calls = 0;
    server.use(
      http.post(LOGIN, async () => {
        calls++;
        await delay(100);
        return HttpResponse.json(okLogin);
      }),
    );
    const { container, navigate } = await renderLogin();
    await fillValid();
    const form = container.querySelector('form') as HTMLFormElement;
    // Sin esperar a que el botón se deshabilite: lo que protege aquí es la guarda del componente.
    fireEvent.submit(form);
    fireEvent.submit(form);
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls).toBe(1);
  });

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    await renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(passwordInput()).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(passwordInput()).toHaveAttribute('type', 'password');
  });
});
