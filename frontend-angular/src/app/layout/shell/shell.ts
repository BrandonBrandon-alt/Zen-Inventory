import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';

/** Estructura de las pantallas autenticadas: menú lateral + contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh bg-surface' },
  template: `
    <app-sidebar />
    <main class="min-w-0 flex-1 pb-10">
      <router-outlet />
    </main>
  `,
})
export class Shell {}
