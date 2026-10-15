import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '@core/api/api-error';
import { Badge } from '@shared/ui/badge/badge';
import { DataTable, DataTableCell, type TableColumn } from '@shared/ui/data-table/data-table';
import { type Branch, BranchesApi } from '../../data-access/branches-api';

const COLUMNS: readonly TableColumn<Branch>[] = [
  { key: 'nombre', header: 'Nombre', sortable: true, primary: true },
  { key: 'direccion', header: 'Dirección', sortable: true },
  { key: 'telefono', header: 'Teléfono' },
  { key: 'activa', header: 'Estado', sortable: true },
];

const rowKey = (branch: Branch): number => branch.id;

@Component({
  selector: 'app-branches-page',
  imports: [DataTable, DataTableCell, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './branches-page.html',
})
export class BranchesPage {
  private readonly api = inject(BranchesApi);

  protected readonly columns = COLUMNS;
  protected readonly rowKey = rowKey;

  protected readonly branches = signal<readonly Branch[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly summary = computed(() => {
    const total = this.branches().length;
    const active = this.branches().filter((b) => b.activa).length;
    const sucursales = total === 1 ? '1 sucursal' : `${total} sucursales`;
    return `${sucursales}, ${active} ${active === 1 ? 'activa' : 'activas'}`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.branches.set(await firstValueFrom(this.api.list()));
    } catch (error) {
      this.error.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
