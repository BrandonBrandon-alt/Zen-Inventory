import { ChangeDetectionStrategy, Component, ViewContainerRef, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationService } from './core/notifications/notification.service';
import { ToastContainer } from './layout/toast-container/toast-container';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toast-container />
  `,
})
export class App {
  private readonly notifications = inject(NotificationService);
  private readonly container = inject(ViewContainerRef);
  private successDialogLoaded = false;

  constructor() {
    // El modal de confirmación se descarga recién la primera vez que hay algo que confirmar: así no pesa en el
    // arranque (presupuesto de angular.json). Una vez creado, se muestra y se oculta solo según el servicio.
    effect(() => {
      if (!this.notifications.confirmation() || this.successDialogLoaded) return;
      this.successDialogLoaded = true;
      void import('./layout/success-dialog/success-dialog').then(({ SuccessDialog }) => this.container.createComponent(SuccessDialog));
    });
  }
}
