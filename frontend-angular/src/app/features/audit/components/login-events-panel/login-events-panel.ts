import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideCalendar, LucideMapPin, LucideMail, LucideSearch, LucideShield, LucideUser } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { Badge, type BadgeVariant } from '@shared/ui/badge/badge';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { LOGIN_OUTCOMES, LoginAuditApi, type LoginEvent, type LoginOutcome } from '../../data-access/login-audit-api';

const PAGE_SIZE = 15;
const SEARCH_DELAY_MS = 300;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

export const OUTCOME_INFO: Record<LoginOutcome, { label: string; variant: BadgeVariant }> = {
  EXITOSO: { label: 'Exitoso', variant: 'success' },
  CREDENCIALES_INVALIDAS: { label: 'Credenciales inválidas', variant: 'danger' },
  CUENTA_DESACTIVADA: { label: 'Cuenta desactivada', variant: 'warning' },
  BLOQUEADO: { label: 'Bloqueado por intentos', variant: 'danger' },
};

interface LoginRow extends LoginEvent {
  readonly person: string;
  readonly outcomeLabel: string;
}

/**
 * Inicios de sesión de la Auditoría Global (solo ADMIN): cada intento, exitoso o no, con el correo, la persona, el
 * resultado y la IP. Paginado en el servidor.
 */
@Component({
  selector: 'app-login-events-panel',
  imports: [Badge, DataTable, DataTableCell, DatePicker, ActiveFilters, FormField, InputDirective, Select, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (!error() && total() > 0) {
      <p class="mb-3 text-sm text-fg-subtle">{{ summary() }}</p>
    }
    <div class="mb-3 grid grid-cols-2 items-center gap-3 md:grid-cols-4">
      <div class="col-span-2 md:col-span-1">
        <app-form-field>
          <input appInput type="search" placeholder="Buscar correo o persona…" aria-label="Buscar inicio de sesión" autocomplete="off" [value]="search()" (input)="onSearch($event)" />
          <svg data-slot="prefix" lucideSearch [size]="16" aria-hidden="true"></svg>
        </app-form-field>
      </div>
      <div><app-select [(value)]="outcome" [options]="outcomeOptions" ariaLabel="Resultado" /></div>
      <div><app-date-picker [(value)]="from" [max]="to()" placeholder="Desde" ariaLabel="Desde" /></div>
      <div><app-date-picker [(value)]="to" [min]="from()" placeholder="Hasta" ariaLabel="Hasta" /></div>
    </div>
    <app-active-filters class="mb-4" [filters]="activeFilters()" (removed)="removeFilter($event)" (cleared)="clearFilters()" />

    <app-data-table
      caption="Intentos de inicio de sesión"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [pageSize]="pageSize"
      [total]="total()"
      [(page)]="page"
      [emptyTitle]="activeFilters().length > 0 ? 'Ningún inicio de sesión coincide' : 'Todavía no hay inicios de sesión registrados'"
      [emptyDescription]="activeFilters().length > 0 ? 'Prueba quitando algún filtro.' : 'Cada intento de entrar al sistema, exitoso o no, aparecerá aquí.'"
      minWidth="48rem"
      (retry)="load()"
    >
      <ng-template appCell="outcomeLabel" let-e>
        <app-badge [variant]="variant(e)" dot>{{ e.outcomeLabel }}</app-badge>
      </ng-template>
    </app-data-table>
  `,
})
export class LoginEventsPanel {
  private readonly api = inject(LoginAuditApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly rowKey = (row: LoginRow): number => row.id;

  protected readonly rows = signal<readonly LoginRow[]>([]);
  protected readonly total = signal(0);
  private readonly failures = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly search = signal('');
  private readonly searchTerm = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly outcome = signal<LoginOutcome | null>(null);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);

  protected readonly outcomeOptions: readonly SelectOption<LoginOutcome | null>[] = [
    { value: null, label: 'Todos los resultados' },
    ...LOGIN_OUTCOMES.map((value) => ({ value, label: OUTCOME_INFO[value].label })),
  ];

  protected readonly columns: readonly TableColumn<LoginRow>[] = [
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, nowrap: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
    { key: 'email', header: 'Correo', icon: LucideMail.icon, primary: true },
    { key: 'person', header: 'Persona', icon: LucideUser.icon },
    { key: 'outcomeLabel', header: 'Resultado', icon: LucideShield.icon },
    { key: 'ip', header: 'IP', icon: LucideMapPin.icon },
  ];

  private readonly filters = computed(() => ({ outcome: this.outcome(), from: this.from(), to: this.to(), text: this.searchTerm() }));
  protected readonly page = linkedSignal<unknown, number>({ source: this.filters, computation: () => 1 });
  private readonly query = computed(() => ({ ...this.filters(), page: this.page(), size: PAGE_SIZE }));

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (this.outcome()) list.push({ id: 'outcome', label: 'Resultado', text: OUTCOME_INFO[this.outcome()!].label });
    if (this.from()) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to()) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly summary = computed(() => {
    const total = this.total();
    const failures = this.failures();
    const attempts = total === 1 ? '1 intento' : `${formatQuantity(total)} intentos`;
    return `${attempts}, ${failures === 1 ? '1 fallido' : `${formatQuantity(failures)} fallidos`}`;
  });

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => void this.load(query));
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
  }

  private loadId = 0;

  protected async load(query = untracked(this.query)): Promise<void> {
    const id = ++this.loadId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(this.api.search(query));
      if (id !== this.loadId) return;
      this.rows.set(page.events.map((e) => ({ ...e, person: e.userName ?? 'Sin cuenta', outcomeLabel: OUTCOME_INFO[e.outcome].label, ip: e.ip || '—' })));
      this.total.set(page.total);
      this.failures.set(page.failures);
    } catch (error) {
      if (id === this.loadId) this.error.set(toApiError(error).message);
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchTerm.set(value.trim()), SEARCH_DELAY_MS);
  }

  protected variant(row: LoginRow): BadgeVariant {
    return OUTCOME_INFO[row.outcome].variant;
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'outcome': this.outcome.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'search': this.search.set(''); clearTimeout(this.searchTimer); this.searchTerm.set(''); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }
}
