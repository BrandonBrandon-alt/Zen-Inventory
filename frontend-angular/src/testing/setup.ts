import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw-server';

// jsdom trae <dialog> pero no showModal()/close(): se simulan con lo esencial (atributo `open` y evento `close`).
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    // Como en los navegadores: abrir un diálogo que ya está abierto es un error.
    if (this.hasAttribute('open')) throw new DOMException('El diálogo ya está abierto.', 'InvalidStateError');
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// Toda petición sin handler falla el test: así no hay llamadas de red accidentales.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
