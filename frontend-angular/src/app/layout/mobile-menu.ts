import { Injectable, signal } from '@angular/core';

/** Estado abierto/cerrado del menú en pantallas pequeñas (donde es un cajón). */
@Injectable({ providedIn: 'root' })
export class MobileMenu {
  private readonly state = signal(false);

  readonly open = this.state.asReadonly();

  toggle(): void {
    this.state.update((open) => !open);
  }

  close(): void {
    this.state.set(false);
  }
}
