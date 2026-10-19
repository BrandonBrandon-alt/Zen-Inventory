import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideDynamicIcon,
  LucideLogOut,
  LucidePanelLeftClose,
  LucidePin,
  LucideX,
} from '@lucide/angular';
import { LOGIN_URL } from '@core/auth/auth-urls';
import { AlertCount } from '@core/alerts/alert-count';
import { AuthStore } from '@core/auth/session/auth-store';
import { Logo } from '@shared/ui/logo/logo';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
import { MobileMenu } from '../mobile-menu';
import { type NavItem, navSectionsFor } from '../nav-items';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SidebarState,
} from '../sidebar-state';
import { UserCard } from '../user-card/user-card';
import { Viewport } from '../viewport';

/** Cuánto cambia el ancho (px) con cada pulsación de flecha en el borde. */
const KEYBOARD_STEP = 16;

/** Espera (ms) antes de esconder el menú al sacar el puntero: evita que un roce fuera lo cierre. */
const HIDE_DELAY = 350;

/** Ancho (px) de la franja del borde que, al acercarse, abre el menú oculto. */
const EDGE_WIDTH = 10;

/** Cuántas pantallas del menú tienen atajo Ctrl + número (las teclas 1 a 9). */
const MAX_NAV_SHORTCUTS = 9;

@Component({
  selector: 'app-sidebar',
  imports: [
    RouterLink,
    RouterLinkActive,
    Logo,
    UserCard,
    LucideDynamicIcon,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLogOut,
    LucidePanelLeftClose,
    LucidePin,
    LucideX,
    ThemeToggle,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Escritorio: barra fija que empuja el contenido. Móvil: cajón fuera de pantalla que se desliza al abrirse.
    class: 'fixed inset-y-0 left-0 z-50 block h-dvh w-72 transition-transform duration-300 md:translate-x-0',
    '[class]': 'desktopClass()',
    '[style.width.px]': 'hostWidth()',
    '[class.select-none]': 'resizing()',
    '(mouseenter)': 'onEnter()',
    '(mouseleave)': 'scheduleHide()',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'onFocusOut($event)',
    '(keydown.escape)': 'hidePeek()',
    '(document:keydown)': 'onShortcut($event)',
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '[class.-translate-x-full]': '!viewport.isDesktop() && !menu.open()',
    // Cerrado en móvil: no recibe foco ni lo lee un lector de pantalla.
    '[attr.inert]': '!viewport.isDesktop() && !menu.open() ? "" : null',
  },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly state = inject(SidebarState);
  protected readonly viewport = inject(Viewport);
  protected readonly menu = inject(MobileMenu);
  protected readonly alertCount = inject(AlertCount).count;

  protected readonly minWidth = SIDEBAR_MIN_WIDTH;
  protected readonly maxWidth = SIDEBAR_MAX_WIDTH;
  protected readonly resizing = signal(false);

  /** Escritorio con "ocultar automáticamente": el menú vive fuera de pantalla hasta que se le acerca el puntero. */
  protected readonly autoHidden = computed(() => this.viewport.isDesktop() && this.state.autoHide());
  private readonly peeking = signal(false);
  /** Abierto con el atajo: se queda abierto aunque el puntero salga, hasta volver a usar el atajo, Escape o pulsar fuera. */
  private readonly pinnedOpen = signal(false);
  /** Visible: siempre en modo fijo; en modo oculto, solo mientras se le acerca el puntero o el foco. */
  protected readonly shown = computed(() => !this.autoHidden() || this.peeking());
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** Solo el escritorio fijo tiene menú colapsado (solo iconos); el cajón móvil y el menú oculto se ven completos. */
  protected readonly compact = computed(() => this.viewport.isDesktop() && this.state.collapsed() && !this.state.autoHide());
  protected readonly desktopClass = computed(() =>
    this.autoHidden()
      ? 'md:fixed md:inset-y-0 md:left-0 md:z-50'
      : 'md:sticky md:top-0 md:z-40 md:w-auto md:shrink-0',
  );
  /** En modo oculto el contenedor mide solo la franja del borde (o el menú entero mientras se ve), sin empujar el contenido. */
  protected readonly hostWidth = computed(() => (this.autoHidden() ? (this.shown() ? this.state.width() : EDGE_WIDTH) : null));
  protected readonly asideClass = computed(() => {
    const motion = this.resizing() ? '' : 'transition-[width] duration-300';
    if (!this.autoHidden()) return motion;
    // Entra con calma y sale más rápido: al apartarse se quiere recuperar el espacio sin esperar.
    return (
      'absolute top-0 left-0 transition-[transform,visibility,box-shadow] ' +
      (this.shown()
        ? 'translate-x-0 shadow-2xl duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        : '-translate-x-full invisible shadow-none duration-200 ease-in')
    );
  });
  protected readonly sections = computed(() => navSectionsFor(this.store.role()));

  /** Ctrl + 1…9 llevan a las primeras nueve pantallas del menú, en el orden en que se ven. */
  private readonly shortcutItems = computed(() => this.sections().flatMap((s) => s.items).slice(0, MAX_NAV_SHORTCUTS));
  protected readonly widthPx = computed(() =>
    this.state.collapsed() && !this.state.autoHide() ? SIDEBAR_COLLAPSED_WIDTH : this.state.width(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearHideTimer());
    // Elegir una pantalla cierra el cajón.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menu.close());
  }

  protected onEnter(): void {
    if (!this.autoHidden()) return;
    this.clearHideTimer();
    this.peeking.set(true);
  }

  protected onFocusIn(): void {
    if (this.autoHidden()) this.onEnter();
  }

  /** Al salir el foco del menú se esconde; mover el foco entre sus propios enlaces no. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (this.autoHidden() && !(next instanceof Node && this.host.nativeElement.contains(next))) this.scheduleHide();
  }

  /**
   * Ctrl + S (o ⌘ + S) esconde y muestra el menú: en escritorio con "ocultar automáticamente" lo abre o lo cierra, con el
   * menú fijo lo contrae o lo expande, y en móvil abre o cierra el cajón. Sustituye al "Guardar página" del navegador.
   */
  protected onShortcut(event: KeyboardEvent): void {
    if (this.onNavShortcut(event)) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    if (!this.viewport.isDesktop()) {
      this.menu.toggle();
    } else if (this.state.autoHide()) {
      if (this.peeking() && this.pinnedOpen()) {
        this.hidePeek();
      } else {
        this.clearHideTimer();
        this.peeking.set(true);
        this.pinnedOpen.set(true);
      }
    } else {
      this.state.toggle();
    }
  }

  /** Ctrl + número: va a esa pantalla del menú. Devuelve si el evento era uno de estos atajos. */
  private onNavShortcut(event: KeyboardEvent): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !/^[1-9]$/.test(event.key)) return false;
    const item = this.shortcutItems()[Number(event.key) - 1];
    if (!item) return false;
    // Sustituye al cambio de pestaña del navegador (donde este permite reemplazarlo).
    event.preventDefault();
    void this.router.navigateByUrl(item.path);
    this.menu.close();
    return true;
  }

  /** El número del atajo Ctrl + n de una pantalla del menú; `null` si no tiene (solo las nueve primeras). */
  protected shortcutOf(item: NavItem): number | null {
    const index = this.shortcutItems().findIndex((i) => i.path === item.path);
    return index === -1 ? null : index + 1;
  }

  /** Pulsar fuera cierra un menú abierto con el atajo (abierto con el puntero se cierra al alejarlo). */
  protected onOutsidePointer(event: PointerEvent): void {
    if (this.pinnedOpen() && !(event.target instanceof Node && this.host.nativeElement.contains(event.target))) this.hidePeek();
  }

  protected scheduleHide(): void {
    // Mientras se arrastra el borde para cambiar el ancho el puntero puede salirse sin que el menú deba cerrarse.
    if (!this.autoHidden() || this.resizing() || this.pinnedOpen()) return;
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => this.hidePeek(), HIDE_DELAY);
  }

  protected hidePeek(): void {
    this.clearHideTimer();
    this.pinnedOpen.set(false);
    if (!this.peeking()) return;
    this.peeking.set(false);
    // Si el foco quedó dentro del menú que se esconde, se suelta para no dejarlo en un elemento invisible.
    const active = this.host.nativeElement.ownerDocument.activeElement;
    if (active instanceof HTMLElement && this.host.nativeElement.contains(active)) active.blur();
  }

  private clearHideTimer(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  /** Texto de la insignia: más de 99 se resume como "99+". */
  protected badgeText(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  /**
   * Descripción de un enlace del menú. Con el menú completo el nombre ya se ve, así que solo se explica para qué sirve;
   * contraído (solo iconos), el nombre va primero. Si hay alertas activas, se dice cuántas.
   */
  protected tooltipFor(item: NavItem): string {
    const count = item.alertBadge ? this.alertCount() : 0;
    const shortcut = this.shortcutOf(item);
    const lines = [this.compact() ? item.label : '', item.description, count > 0 ? `${count} ${count === 1 ? 'activa' : 'activas'} ahora.` : '', shortcut ? `Atajo: Ctrl + ${shortcut}` : ''];
    return lines.filter(Boolean).join('\n');
  }

  protected linkLabel(item: NavItem): string {
    const count = item.alertBadge ? this.alertCount() : 0;
    return count > 0 ? `${item.label}, ${count} ${count === 1 ? 'activa' : 'activas'}` : item.label;
  }

  protected logout(): void {
    this.store.clear();
    void this.router.navigateByUrl(LOGIN_URL);
  }

  protected startResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    // Con la captura, los eventos siguen llegando al borde aunque el puntero salga de él.
    if (typeof handle.setPointerCapture === 'function') handle.setPointerCapture(event.pointerId);
    this.resizing.set(true);
  }

  protected onResize(event: PointerEvent): void {
    if (!this.resizing()) return;
    this.state.setWidth(event.clientX - this.host.nativeElement.getBoundingClientRect().left);
  }

  protected endResize(): void {
    this.resizing.set(false);
  }

  protected onResizeKey(event: KeyboardEvent): void {
    const width = this.state.width();
    const next: Record<string, number> = {
      ArrowRight: width + KEYBOARD_STEP,
      ArrowLeft: width - KEYBOARD_STEP,
      Home: SIDEBAR_MIN_WIDTH,
      End: SIDEBAR_MAX_WIDTH,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    this.state.setWidth(next[event.key]);
  }
}
