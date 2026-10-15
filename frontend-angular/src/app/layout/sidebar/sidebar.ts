import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideDynamicIcon,
  LucideLogOut,
  LucideX,
} from '@lucide/angular';
import { LOGIN_URL } from '@core/auth/auth-urls';
import { AuthStore } from '@core/auth/session/auth-store';
import { Logo } from '@shared/ui/logo/logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
import { MobileMenu } from '../mobile-menu';
import { navSectionsFor } from '../nav-items';
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
    LucideX,
    ThemeToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Escritorio: barra fija que empuja el contenido. Móvil: cajón fuera de pantalla que se desliza al abrirse.
    class:
      'fixed inset-y-0 left-0 z-50 block h-dvh w-72 transition-transform duration-300 ' +
      'md:sticky md:top-0 md:z-40 md:w-auto md:shrink-0 md:translate-x-0',
    '[class.select-none]': 'resizing()',
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

  protected readonly minWidth = SIDEBAR_MIN_WIDTH;
  protected readonly maxWidth = SIDEBAR_MAX_WIDTH;
  protected readonly resizing = signal(false);

  /** Solo el escritorio tiene menú colapsado (solo iconos); en móvil el cajón siempre se ve completo. */
  protected readonly compact = computed(() => this.viewport.isDesktop() && this.state.collapsed());
  protected readonly sections = computed(() => navSectionsFor(this.store.role()));
  protected readonly widthPx = computed(() =>
    this.state.collapsed() ? SIDEBAR_COLLAPSED_WIDTH : this.state.width(),
  );

  constructor() {
    // Elegir una pantalla cierra el cajón.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menu.close());
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
