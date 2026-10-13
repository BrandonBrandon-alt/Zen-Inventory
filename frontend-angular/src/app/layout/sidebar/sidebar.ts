import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideDynamicIcon,
  LucideLogOut,
  LucideMoon,
  LucideSun,
} from '@lucide/angular';
import { LOGIN_URL } from '@core/auth/auth-urls';
import { AuthStore } from '@core/auth/session/auth-store';
import { ThemeService } from '@core/theme/theme.service';
import { Logo } from '@shared/ui/logo/logo';
import { navSectionsFor } from '../nav-items';
import { SidebarState } from '../sidebar-state';
import { UserCard } from '../user-card/user-card';

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
    LucideMoon,
    LucideSun,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 z-40 block h-dvh shrink-0' },
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly state = inject(SidebarState);

  protected readonly sections = computed(() => navSectionsFor(this.store.role()));

  protected logout(): void {
    this.store.clear();
    void this.router.navigateByUrl(LOGIN_URL);
  }
}
