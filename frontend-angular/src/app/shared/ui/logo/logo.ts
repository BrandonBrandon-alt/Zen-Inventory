import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Petal {
  readonly d: string;
  readonly width: number;
  readonly opacity: number;
}

/** Flor de loto: pétalos de atrás hacia adelante. */
const PETALS: readonly Petal[] = [
  { d: 'M60 75 Q20 60 15 30 Q35 45 60 75Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 75 Q100 60 105 30 Q85 45 60 75Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 75 Q10 55 8 20 Q32 38 60 75Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 75 Q110 55 112 20 Q88 38 60 75Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 80 Q42 95 38 115 Q55 100 60 80Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 80 Q78 95 82 115 Q65 100 60 80Z', width: 1.5, opacity: 0.7 },
  { d: 'M60 80 Q60 100 60 118 Q60 100 60 80Z', width: 1.5, opacity: 0.5 },
  { d: 'M60 70 Q28 58 22 28 Q44 46 60 70Z', width: 1.8, opacity: 0.85 },
  { d: 'M60 70 Q92 58 98 28 Q76 46 60 70Z', width: 1.8, opacity: 0.85 },
  { d: 'M60 72 Q40 60 42 35 Q53 52 60 72Z', width: 1.5, opacity: 0.9 },
  { d: 'M60 72 Q80 60 78 35 Q67 52 60 72Z', width: 1.5, opacity: 0.9 },
  { d: 'M60 72 Q50 40 60 8 Q70 40 60 72Z', width: 2, opacity: 1 },
  { d: 'M60 72 Q42 42 48 12 Q58 42 60 72Z', width: 1.8, opacity: 1 },
  { d: 'M60 72 Q78 42 72 12 Q62 42 60 72Z', width: 1.8, opacity: 1 },
];

/** Nervaduras que parten del centro de la flor. */
const VEINS: readonly { readonly x2: number; readonly y2: number }[] = [
  { x2: 60, y2: 30 },
  { x2: 38, y2: 42 },
  { x2: 82, y2: 42 },
];

/** Logo de Zen Inventory. Toma el color de marca (`text-brand`) salvo que el contenedor indique otro. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2 text-brand' },
  template: `
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.role]="showText() ? null : 'img'"
      [attr.aria-label]="showText() ? null : 'Zen Inventory'"
      [attr.aria-hidden]="showText() ? 'true' : null"
    >
      @for (petal of petals; track petal.d) {
        <path [attr.d]="petal.d" [attr.stroke-width]="petal.width" [attr.opacity]="petal.opacity" />
      }
      @for (vein of veins; track vein.x2) {
        <line x1="60" y1="72" [attr.x2]="vein.x2" [attr.y2]="vein.y2" stroke-width="0.8" opacity="0.3" />
      }
    </svg>
    @if (showText()) {
      <span class="text-sm font-bold tracking-[0.15em] uppercase">Zen Inventory</span>
    }
  `,
})
export class Logo {
  readonly size = input(48);
  readonly showText = input(false);

  protected readonly petals = PETALS;
  protected readonly veins = VEINS;
}
