import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Marcador de las pantallas que aún viven solo en el frontend de Next.js. */
@Component({
  selector: 'app-not-migrated-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  template: `
    <h1 class="mb-2 font-title text-[28px] font-bold tracking-tight text-fg">{{ title }}</h1>
    <p class="text-sm text-fg-subtle">Esta pantalla todavía no está disponible en la nueva versión.</p>
  `,
})
export class NotMigratedPage {
  protected readonly title = String(inject(ActivatedRoute).snapshot.data['title'] ?? '');
}
