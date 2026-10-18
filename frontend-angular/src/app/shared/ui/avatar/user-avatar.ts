import { ChangeDetectionStrategy, Component, booleanAttribute, computed, inject, input } from '@angular/core';
import { AvatarStore } from '@core/profile/avatar-store';
import { Avatar, type AvatarSize } from './avatar';

/**
 * Avatar de un usuario del sistema: pide su foto a la API cuando tiene una (`version` presente) y, si no, muestra
 * sus iniciales. Para una foto que no es de la API (una vista previa, por ejemplo) usa `app-avatar` con `src`.
 */
@Component({
  selector: 'app-user-avatar',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `<app-avatar [name]="name()" [src]="src()" [size]="size()" [decorative]="decorative()" />`,
})
export class UserAvatar {
  private readonly store = inject(AvatarStore);

  readonly userId = input.required<number>();
  readonly name = input.required<string>();
  /** Versión de la foto (`avatarActualizadoEn`); vacía si el usuario no tiene foto. */
  readonly version = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('md');
  readonly decorative = input(true, { transform: booleanAttribute });

  protected readonly src = computed(() => {
    const version = this.version();
    return version ? this.store.urlFor(this.userId(), version)() : null;
  });
}
