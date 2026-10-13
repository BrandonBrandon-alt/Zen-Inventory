import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { LucideMapPin } from '@lucide/angular';
import { of, switchMap } from 'rxjs';
import { AuthStore } from '@core/auth/session/auth-store';
import { BranchLabelApi, DEFAULT_BRANCH_LABEL } from '../data-access/branch-label-api';

/** Datos del usuario en sesión: inicial, nombre y ámbito (sucursal o gestión global). */
@Component({
  selector: 'app-user-card',
  imports: [LucideMapPin],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (session(); as current) {
      <div
        class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-card p-3"
        [class.justify-center]="compact()"
      >
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand to-warning text-[13px] font-black text-white"
          aria-hidden="true"
        >
          {{ initial() }}
        </div>
        @if (!compact()) {
          <div class="min-w-0">
            <p class="truncate text-[13px] font-bold text-fg">{{ current.nombre }}</p>
            <p class="mt-0.5 flex items-center gap-1 text-[10px] text-fg-subtle">
              <svg lucideMapPin [size]="10" class="shrink-0" />
              <span class="truncate">{{ label() }}</span>
            </p>
          </div>
        }
      </div>
    }
  `,
})
export class UserCard {
  readonly compact = input(false);

  private readonly api = inject(BranchLabelApi);
  protected readonly session = inject(AuthStore).session;

  protected readonly initial = computed(() => this.session()?.nombre.charAt(0).toUpperCase() || 'U');
  protected readonly label = toSignal(
    toObservable(this.session).pipe(
      switchMap((current) => (current ? this.api.labelFor(current) : of(DEFAULT_BRANCH_LABEL))),
    ),
    { initialValue: DEFAULT_BRANCH_LABEL },
  );
}
