import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideMapPin } from '@lucide/angular';
import { of, switchMap } from 'rxjs';
import { AuthStore } from '@core/auth/session/auth-store';
import { UserAvatar } from '@shared/ui/avatar/user-avatar';
import { BranchLabelApi, DEFAULT_BRANCH_LABEL } from '../data-access/branch-label-api';

/** Datos del usuario en sesión: inicial, nombre y ámbito (sucursal o gestión global). */
@Component({
  selector: 'app-user-card',
  imports: [LucideMapPin, RouterLink, UserAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (session(); as current) {
      <a
        routerLink="/profile"
        class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-card p-3 transition-colors hover:border-line focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        [class.justify-center]="compact()"
        [attr.aria-label]="'Mi perfil, ' + current.nombre"
      >
        <app-user-avatar [userId]="current.id" [name]="current.nombre" [version]="current.avatarVersion" />
        @if (!compact()) {
          <div class="min-w-0">
            <p class="truncate text-[13px] font-bold text-fg">{{ current.nombre }}</p>
            <p class="mt-0.5 flex items-center gap-1 text-[10px] text-fg-subtle">
              <svg lucideMapPin [size]="10" class="shrink-0" />
              <span class="truncate">{{ label() }}</span>
            </p>
          </div>
        }
      </a>
    }
  `,
})
export class UserCard {
  readonly compact = input(false);

  private readonly api = inject(BranchLabelApi);
  protected readonly session = inject(AuthStore).session;

  protected readonly label = toSignal(
    toObservable(this.session).pipe(
      switchMap((current) => (current ? this.api.labelFor(current) : of(DEFAULT_BRANCH_LABEL))),
    ),
    { initialValue: DEFAULT_BRANCH_LABEL },
  );
}
