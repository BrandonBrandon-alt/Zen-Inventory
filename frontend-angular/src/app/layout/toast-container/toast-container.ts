import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '@core/notifications/notification.service';
import { Toast } from '@shared/ui/toast/toast';

/** Zona de avisos globales. Va una sola vez en la raíz de la app, para que se vean también en el login. */
@Component({
  selector: 'app-toast-container',
  imports: [Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2' },
  template: `
    @for (item of notifications.items(); track item.id) {
      <app-toast
        class="pointer-events-auto"
        animate.enter="animate-toast-in"
        animate.leave="animate-toast-out"
        [kind]="item.kind"
        [message]="item.message"
        (dismissed)="notifications.dismiss(item.id)"
      />
    }
  `,
})
export class ToastContainer {
  protected readonly notifications = inject(NotificationService);
}
