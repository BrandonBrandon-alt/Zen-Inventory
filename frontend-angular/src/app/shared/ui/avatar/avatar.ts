import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, linkedSignal } from '@angular/core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-9 text-[13px]',
  lg: 'size-14 text-xl',
  xl: 'size-28 text-4xl',
};

/** Primera letra de la primera y la última palabra ("Ana María Pérez" → "AP"); una sola palabra da una letra. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => /\p{L}/u.exec(word)?.[0])
    .filter((letter): letter is string => letter !== undefined);
  if (letters.length === 0) return '?';
  const picked = letters.length === 1 ? letters[0] : letters[0] + letters[letters.length - 1];
  return picked.toLocaleUpperCase('es');
}

/**
 * Color de fondo estable para un nombre: el mismo nombre siempre da el mismo tono. Saturación y luminosidad fijas
 * (letras blancas legibles en cualquier tono) y solo cambia el matiz, así todos los avatares se ven de la misma familia.
 */
export function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name.trim().toLocaleLowerCase('es')) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return `hsl(${hash % 360} 42% 38%)`;
}

/**
 * Foto de una persona o, si no hay (o no carga), sus iniciales sobre un color propio.
 * Por defecto es decorativo porque el nombre suele estar al lado; con `decorative=false` se anuncia como imagen.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white select-none',
    '[class]': 'sizeClass()',
    '[style.background-color]': 'color()',
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : name()',
    '[attr.aria-hidden]': 'decorative() ? true : null',
  },
  template: `
    @if (showImage()) {
      <img [src]="src()" alt="" draggable="false" class="size-full object-cover" (error)="failed.set(true)" />
    } @else {
      <span aria-hidden="true">{{ letters() }}</span>
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  /** URL de la foto; sin ella (o si falla al cargar) se muestran las iniciales. */
  readonly src = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('md');
  readonly decorative = input(true, { transform: booleanAttribute });

  /** Vuelve a intentar cuando cambia la URL (p. ej. se subió otra foto tras un fallo). */
  protected readonly failed = linkedSignal<string | null | undefined, boolean>({ source: this.src, computation: () => false });

  protected readonly showImage = computed(() => !!this.src() && !this.failed());
  protected readonly letters = computed(() => initials(this.name()));
  protected readonly color = computed(() => avatarColor(this.name()));
  protected readonly sizeClass = computed(() => SIZES[this.size()]);
}
