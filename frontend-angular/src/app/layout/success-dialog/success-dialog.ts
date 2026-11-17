import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '@core/notifications/notification.service';
import { Button } from '@shared/ui/button/button';
import { Modal } from '@shared/ui/modal/modal';

/**
 * Confirmación de una acción importante (`NotificationService.confirm`): un modal con lo que pasó y qué sigue, que la
 * persona cierra con «Entendido». Va una sola vez en la raíz de la app, junto a los toasts.
 */
@Component({
  selector: 'app-success-dialog',
  imports: [Modal, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (notifications.confirmation(); as confirmation) {
      <app-modal [open]="true" (openChange)="$event || notifications.dismissConfirmation()" [title]="confirmation.title" size="sm">
        <div class="flex flex-col items-center gap-3 pt-2 text-center" role="status">
          <span class="flex size-14 items-center justify-center rounded-full bg-success/15">
            <svg viewBox="0 0 16 16" class="size-7 fill-none stroke-success" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 8.5 6.4 12 13 4.5" pathLength="1" stroke-dasharray="1" class="animate-check-draw" />
            </svg>
          </span>
          <p class="text-base font-semibold text-fg">{{ confirmation.summary }}</p>
          @if (confirmation.detail; as detail) {
            <p class="max-w-prose text-sm text-fg-muted">{{ detail }}</p>
          }
        </div>
        <div data-slot="footer">
          <button appButton type="button" (click)="notifications.dismissConfirmation()">Entendido</button>
        </div>
      </app-modal>
    }
  `,
})
export class SuccessDialog {
  protected readonly notifications = inject(NotificationService);
}
