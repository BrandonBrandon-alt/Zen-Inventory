import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Tooltip } from '../tooltip/tooltip';

export type ModalSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

let nextId = 0;
/** Cuántos modales abiertos bloquean el scroll de la página: solo se libera al cerrar el último. */
let scrollLocks = 0;

/**
 * Ventana modal sobre un `<dialog>` nativo. El navegador se encarga de lo difícil: atrapar el foco, hacer inerte el
 * resto de la página, cerrar con Escape y devolver el foco a quien lo abrió.
 *
 * ```html
 * <app-modal [(open)]="creating" title="Nueva sucursal" description="Completa los datos.">
 *   <form>…</form>
 *   <div data-slot="footer"><button appButton>Guardar</button></div>
 * </app-modal>
 * ```
 *
 * - `[(open)]` se actualiza solo cuando el usuario lo cierra (X, Escape o fondo).
 * - `closed` se emite únicamente cuando lo cierra el usuario, no cuando lo cierra el padre.
 * - `dismissible = false` impide cerrarlo (Escape, fondo, X): para operaciones en curso como guardar.
 */
@Component({
  selector: 'app-modal',
  imports: [LucideX, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <!-- El clic en el fondo es un atajo para el ratón: quien usa teclado cierra con Escape o con el botón "Cerrar". -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #dialog
      class="relative m-auto w-[calc(100vw-2rem)] rounded-xl border border-line bg-card p-0 text-fg shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-[2px] open:animate-modal-in open:backdrop:animate-backdrop-in"
      [class]="sizeClass()"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="description() ? descriptionId : null"
      (close)="onClose()"
      (cancel)="onCancel($event)"
      (click)="onDialogClick($event)"
    >
      <div class="flex max-h-[85dvh] flex-col">
        <div class="px-6 pt-6 pb-4" [class.pr-14]="dismissible()">
          <h2 [id]="titleId" class="font-title text-xl font-bold tracking-tight text-fg">{{ title() }}</h2>
          @if (description(); as text) {
            <p [id]="descriptionId" class="mt-1 text-sm text-fg-subtle">{{ text }}</p>
          }
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6"><ng-content /></div>

        <!-- Los botones van dentro del contenedor proyectado [data-slot=footer]: es él quien los separa (gap-3). -->
        <footer
          class="border-t border-line px-6 py-4 empty:hidden [&>[data-slot=footer]]:flex [&>[data-slot=footer]]:flex-wrap [&>[data-slot=footer]]:items-center [&>[data-slot=footer]]:justify-end [&>[data-slot=footer]]:gap-3"
        >
          <ng-content select="[data-slot=footer]" />
        </footer>
      </div>

      <!-- Último en el DOM a propósito: el foco inicial cae en el primer campo del contenido, no en la X. -->
      @if (dismissible()) {
        <button
          type="button"
          class="absolute top-4 right-4 flex size-8 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          aria-label="Cerrar"
          appTooltip="Cerrar"
          (click)="requestClose()"
        >
          <svg lucideX [size]="18" />
        </button>
      }
    </dialog>
  `,
})
export class Modal {
  private readonly body = inject(DOCUMENT).body;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Abierto o cerrado. Bidireccional: `[(open)]`. */
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly size = input<ModalSize>('md');
  /** Si el usuario puede cerrarlo (Escape, fondo, X). Falso mientras hay una operación en curso. */
  readonly dismissible = input(true, { transform: booleanAttribute });

  /** El usuario lo cerró (X, Escape o fondo). */
  readonly closed = output<void>();

  protected readonly titleId = `app-modal-title-${nextId}`;
  protected readonly descriptionId = `app-modal-description-${nextId++}`;
  protected readonly sizeClass = computed(() => SIZES[this.size()]);

  private locked = false;

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.open();
      untracked(() => {
        if (open && !dialog.open) {
          dialog.showModal();
          this.lockScroll();
        } else if (!open && dialog.open) {
          dialog.close();
        }
        if (!open) this.unlockScroll();
      });
    });
    inject(DestroyRef).onDestroy(() => this.unlockScroll());
  }

  protected requestClose(): void {
    this.dialog().nativeElement.close();
  }

  /** Se dispara con cualquier cierre del `<dialog>` (Escape, botón, `form method="dialog"`). */
  protected onClose(): void {
    // Si el cierre lo provocó el padre, `open` ya es falso y no hay nada que sincronizar ni emitir.
    if (!this.open()) return;
    this.open.set(false);
    this.unlockScroll();
    this.closed.emit();
  }

  /** Escape: si no es descartable, se cancela el cierre nativo. */
  protected onCancel(event: Event): void {
    if (!this.dismissible()) event.preventDefault();
  }

  /** Un clic sobre el propio `<dialog>` (y no sobre su contenido) es un clic en el fondo. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.dismissible()) this.requestClose();
  }

  private lockScroll(): void {
    if (this.locked) return;
    this.locked = true;
    if (scrollLocks++ === 0) this.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (!this.locked) return;
    this.locked = false;
    if (--scrollLocks === 0) this.body.style.overflow = '';
  }
}
