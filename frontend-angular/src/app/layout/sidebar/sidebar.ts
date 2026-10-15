import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideDynamicIcon,
  LucideLogOut,
} from '@lucide/angular';
import { LOGIN_URL } from '@core/auth/auth-urls';
import { AuthStore } from '@core/auth/session/auth-store';
import { Logo } from '@shared/ui/logo/logo';
import { ThemeToggle } from '@shared/ui/theme-toggle/theme-toggle';
import { navSectionsFor } from '../nav-items';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SidebarState,
} from '../sidebar-state';
import { UserCard } from '../user-card/user-card';

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
    ThemeToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sticky top-0 z-40 block h-dvh shrink-0',
    '[class.select-none]': 'resizing()',
  },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly state = inject(SidebarState);

  protected readonly minWidth = SIDEBAR_MIN_WIDTH;
  protected readonly maxWidth = SIDEBAR_MAX_WIDTH;
  protected readonly resizing = signal(false);

  protected readonly sections = computed(() => navSectionsFor(this.store.role()));
  protected readonly widthPx = computed(() =>
    this.state.collapsed() ? SIDEBAR_COLLAPSED_WIDTH : this.state.width(),
  );

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
