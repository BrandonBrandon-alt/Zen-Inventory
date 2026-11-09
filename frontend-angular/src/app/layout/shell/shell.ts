import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideMenu } from '@lucide/angular';
import { Logo } from '@shared/ui/logo/logo';
import { MobileMenu } from '../mobile-menu';
import { Sidebar } from '../sidebar/sidebar';
import { Viewport } from '../viewport';

/**
 * Estructura de las pantallas autenticadas: menú + contenido.
 * Escritorio: barra lateral fija. Móvil: barra superior con botón de menú y el menú como cajón sobre el contenido.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Logo, LucideMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-dvh bg-surface',
    '(document:keydown.escape)': 'menu.close()',
  },
  template: `
    <!-- Primer elemento al tabular: salta el menú (unos quince enlaces) y va directo al contenido. -->
    <a
      href="#contenido"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-fg focus:shadow-lg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      (click)="skipToContent($event, content)"
      >Saltar al contenido</a
    >
    <app-sidebar />

    @if (menu.open() && !viewport.isDesktop()) {
      <!-- Fondo del cajón: pulsar fuera lo cierra. -->
      <div class="fixed inset-0 z-40 bg-black/50" aria-hidden="true" (click)="menu.close()"></div>
    }

    <div class="flex min-w-0 flex-1 flex-col">
      @if (!viewport.isDesktop()) {
        <header class="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-base px-4 py-3">
          <button
            type="button"
            class="flex size-9 cursor-pointer items-center justify-center rounded-md border border-line bg-card text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            aria-label="Abrir menú"
            aria-controls="app-sidebar"
            [attr.aria-expanded]="menu.open()"
            (click)="menu.toggle()"
          >
            <svg lucideMenu [size]="18" />
          </button>
          <app-logo [size]="24" [showText]="true" />
        </header>
      }

      <main #content id="contenido" tabindex="-1" class="min-w-0 flex-1 pb-10 outline-none">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly menu = inject(MobileMenu);
  protected readonly viewport = inject(Viewport);

  /** Mueve el foco al contenido sin cambiar la URL (un `href="#…"` normal pasaría por el router). */
  protected skipToContent(event: Event, content: HTMLElement): void {
    event.preventDefault();
    content.focus();
    content.scrollIntoView({ block: 'start' });
  }
}
