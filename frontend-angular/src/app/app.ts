import { ChangeDetectionStrategy, Component, type ComponentRef, DestroyRef, ViewContainerRef, effect, inject } from '@angular/core';
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
  private successDialog: ComponentRef<unknown> | null = null;
  private destroyed = false;

  constructor() {
    // El modal se crea fuera de la plantilla: se destruye a mano junto con la app (si no, queda suelto en el documento,
    // p. ej. entre pruebas).
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.successDialog?.destroy();
    });
    // El modal de confirmación se descarga recién la primera vez que hay algo que confirmar: así no pesa en el
    // arranque (presupuesto de angular.json). Una vez creado, se muestra y se oculta solo según el servicio.
    effect(() => {
      if (!this.notifications.confirmation() || this.successDialogLoaded) return;
      this.successDialogLoaded = true;
      void import('./layout/success-dialog/success-dialog').then(({ SuccessDialog }) => {
        if (!this.destroyed) this.successDialog = this.container.createComponent(SuccessDialog);
      });
    });
  }
}
