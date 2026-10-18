import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Alert } from '../alert/alert';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';

/**
 * Confirmación de una acción (casi siempre destructiva). Mientras `busy`, no se puede cerrar ni confirmar de nuevo.
 * Si la acción falla, la pantalla pasa el mensaje en `error` y el diálogo sigue abierto para reintentar.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal, Button, Alert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [(open)]="open" [title]="title()" size="sm" [dismissible]="!busy()">
      <div class="flex flex-col gap-3">
        @if (error(); as message) {
          <app-alert>{{ message }}</app-alert>
        }
        <p class="text-sm text-fg-muted">{{ message() }}</p>
      </div>
      <div data-slot="footer">
        <button appButton variant="ghost" type="button" [disabled]="busy()" (click)="open.set(false)">Cancelar</button>
        <button appButton [variant]="variant()" type="button" [loading]="busy()" (click)="confirmed.emit()">
          {{ confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialog {
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly variant = input<'primary' | 'danger'>('danger');
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<void>();
}
