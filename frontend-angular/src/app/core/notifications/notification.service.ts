import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export type NotificationKind = 'error' | 'warning' | 'success' | 'info';

export interface AppNotification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly message: string;
}

/**
 * Confirmación destacada de una acción importante (crear o cambiar un documento, mover stock). Se muestra en un modal
 * que hay que cerrar, en vez de un toast que pasa solo.
 */
export interface ConfirmationInput {
  /** Qué documento y qué pasó, corto: «Traslado #5 despachado». Va como título del modal. */
  readonly title: string;
  /** La confirmación en una frase: «El traslado se despachó correctamente.». */
  readonly summary: string;
  /** Qué implica o qué sigue: «La sucursal de destino debe confirmar lo recibido cuando llegue.». */
  readonly detail?: string;
}

export interface Confirmation extends ConfirmationInput {
  readonly id: number;
}

/** Cuánto permanece visible cada tipo de aviso (ms). Los errores duran más: hay que poder leerlos. */
const DURATION_MS: Record<NotificationKind, number> = {
  error: 8_000,
  warning: 6_000,
  success: 4_000,
  info: 4_000,
};

/** Máximo de avisos a la vez; al superarlo se descarta el más antiguo. */
const MAX_VISIBLE = 4;

/**
 * Avisos globales. Toasts para errores de red/servidor, permisos, sesión vencida y confirmaciones secundarias (catálogo,
 * perfil, configuración); un modal (`confirm`) para confirmar las acciones de negocio importantes.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly state = signal<readonly AppNotification[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly items = this.state.asReadonly();

  private readonly confirmationState = signal<Confirmation | null>(null);
  /** La confirmación que se está mostrando en el modal, o `null`. */
  readonly confirmation = this.confirmationState.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((timer) => clearTimeout(timer)));
  }

  show(kind: NotificationKind, message: string): void {
    // Varias peticiones que fallan a la vez producirían el mismo aviso repetido.
    if (this.state().some((n) => n.kind === kind && n.message === message)) return;

    const id = this.nextId++;
    const next = [...this.state(), { id, kind, message }];
    for (const dropped of next.splice(0, Math.max(0, next.length - MAX_VISIBLE))) this.clearTimer(dropped.id);
    this.state.set(next);
    this.timers.set(id, setTimeout(() => this.dismiss(id), DURATION_MS[kind]));
  }

  error(message: string): void {
    this.show('error', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  success(message: string): void {
    this.show('success', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  /**
   * Confirma en un modal una acción importante: qué pasó (título), la confirmación en una frase (resumen) y qué implica
   * o qué sigue (detalle). Si ya había una abierta, la reemplaza.
   */
  confirm(input: ConfirmationInput): void {
    this.confirmationState.set({ ...input, id: this.nextId++ });
  }

  dismissConfirmation(): void {
    this.confirmationState.set(null);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.state.update((items) => items.filter((n) => n.id !== id));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(id);
  }
}
