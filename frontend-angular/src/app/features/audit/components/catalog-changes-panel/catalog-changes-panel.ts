import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { LucideArrowUpDown, LucideCalendar, LucidePackage, LucideSearch, LucideTag, LucideUser } from '@lucide/angular';
import { debouncedText } from '@shared/data/debounced-text';
import { serverPagedList } from '@shared/data/server-paged-list';
import { formatDateTime, formatQuantity } from '@shared/format/format';
import { DataTable, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { ActiveFilters, type ActiveFilter } from '@shared/ui/filters/active-filters';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { CatalogAuditApi, type CatalogChange, type ChangedEntity } from '../../data-access/catalog-audit-api';

const PAGE_SIZE = 15;
const SEARCH_DELAY_MS = 300;
const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });

const ENTITY_LABEL: Record<ChangedEntity, { one: string; many: string }> = {
  PRODUCTO: { one: 'Producto', many: 'Productos' },
  USUARIO: { one: 'Usuario', many: 'Usuarios' },
};

interface ChangeRow extends CatalogChange {
  readonly what: string;
  readonly change: string;
  readonly who: string;
}

/**
 * Cambios del catálogo de la Auditoría Global (solo ADMIN): qué producto o usuario cambió, qué campo, de qué a qué y
 * quién. Paginado en el servidor; mismo diseño que «Inicios de sesión».
 */
@Component({
  selector: 'app-catalog-changes-panel',
  imports: [DataTable, DatePicker, ActiveFilters, FormField, InputDirective, Select, LucideSearch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (!error() && total() > 0) {
      <p class="mb-3 text-sm text-fg-subtle">{{ summary() }}</p>
    }
    <div class="mb-3 grid grid-cols-2 items-center gap-3 md:grid-cols-4">
      <div class="col-span-2 md:col-span-1">
        <app-form-field>
          <input appInput type="search" placeholder="Buscar producto, usuario o campo…" aria-label="Buscar cambio" autocomplete="off" [value]="search()" (input)="onSearch($event)" />
          <svg data-slot="prefix" lucideSearch [size]="16" aria-hidden="true"></svg>
        </app-form-field>
      </div>
      <div><app-select [(value)]="entity" [options]="entityOptions" ariaLabel="Qué cambió" /></div>
      <div><app-date-picker [(value)]="from" [max]="to()" placeholder="Desde" ariaLabel="Desde" /></div>
      <div><app-date-picker [(value)]="to" [min]="from()" placeholder="Hasta" ariaLabel="Hasta" /></div>
    </div>
    <app-active-filters class="mb-4" [filters]="activeFilters()" (removed)="removeFilter($event)" (cleared)="clearFilters()" />

    <app-data-table
      caption="Cambios de productos y usuarios"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="rowKey"
      [loading]="loading()"
      [error]="error()"
      [pageSize]="pageSize"
      [total]="total()"
      [(page)]="page"
      [emptyTitle]="activeFilters().length > 0 ? 'Ningún cambio coincide' : 'Todavía no hay cambios registrados'"
      [emptyDescription]="activeFilters().length > 0 ? 'Prueba quitando algún filtro.' : 'Cada cambio de precio, costo, proveedor, mínimo, rol o estado aparecerá aquí.'"
      minWidth="52rem"
      (retry)="load()"
    />
  `,
})
export class CatalogChangesPanel {
  private readonly api = inject(CatalogAuditApi);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly rowKey = (row: ChangeRow): number => row.id;

  private readonly searchBox = debouncedText(SEARCH_DELAY_MS);
  protected readonly search = this.searchBox.text;
  protected readonly entity = signal<ChangedEntity | null>(null);
  protected readonly from = signal<Date | null>(null);
  protected readonly to = signal<Date | null>(null);

  protected readonly entityOptions: readonly SelectOption<ChangedEntity | null>[] = [
    { value: null, label: 'Todo el catálogo' },
    { value: 'PRODUCTO', label: ENTITY_LABEL.PRODUCTO.many },
    { value: 'USUARIO', label: ENTITY_LABEL.USUARIO.many },
  ];

  protected readonly columns: readonly TableColumn<ChangeRow>[] = [
    { key: 'date', header: 'Fecha', icon: LucideCalendar.icon, nowrap: true, width: '11.5rem', value: (r) => r.date, display: (r) => formatDateTime(r.date) },
    { key: 'what', header: 'Qué', icon: LucidePackage.icon, primary: true },
    { key: 'field', header: 'Campo', icon: LucideTag.icon },
    { key: 'change', header: 'Antes → Después', icon: LucideArrowUpDown.icon },
    { key: 'who', header: 'Quién', icon: LucideUser.icon },
  ];

  private readonly filters = computed(() => ({ entity: this.entity(), from: this.from(), to: this.to(), text: this.searchBox.term() }));
  private readonly list = serverPagedList({
    filters: this.filters,
    size: PAGE_SIZE,
    fetch: (query) =>
      this.api.search(query).pipe(
        map((page) => ({
          ...page,
          rows: page.changes.map((c) => ({
            ...c,
            what: `${ENTITY_LABEL[c.entity].one} «${c.entityName}»`,
            change: `${c.before} → ${c.after}`,
            who: c.userName ?? 'Sistema',
          })),
        })),
      ),
  });
  protected readonly rows = this.list.rows;
  protected readonly total = this.list.total;
  protected readonly loading = this.list.loading;
  protected readonly error = this.list.error;
  protected readonly page = this.list.page;

  protected readonly activeFilters = computed<ActiveFilter[]>(() => {
    const list: ActiveFilter[] = [];
    if (this.entity()) list.push({ id: 'entity', label: 'Qué cambió', text: ENTITY_LABEL[this.entity()!].many });
    if (this.from()) list.push({ id: 'from', label: 'Desde', text: DAY.format(this.from()!) });
    if (this.to()) list.push({ id: 'to', label: 'Hasta', text: DAY.format(this.to()!) });
    if (this.search().trim()) list.push({ id: 'search', label: 'Búsqueda', text: this.search().trim() });
    return list;
  });

  protected readonly summary = computed(() => (this.total() === 1 ? '1 cambio' : `${formatQuantity(this.total())} cambios`));

  protected load(): Promise<void> {
    return this.list.reload();
  }

  protected onSearch(event: Event): void {
    this.searchBox.set((event.target as HTMLInputElement).value);
  }

  protected removeFilter(id: string): void {
    switch (id) {
      case 'entity': this.entity.set(null); break;
      case 'from': this.from.set(null); break;
      case 'to': this.to.set(null); break;
      case 'search': this.searchBox.clear(); break;
    }
  }

  protected clearFilters(): void {
    for (const filter of this.activeFilters()) this.removeFilter(filter.id);
  }
}
