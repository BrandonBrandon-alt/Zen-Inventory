import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { LucideFileDown, LucideStore } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { CompanyInfo } from '@core/company/company-info';
import { formatMoney, formatQuantity } from '@shared/format/format';
import { codecs, persistedFilter } from '@shared/filters/persisted-filter';
import { PrintService } from '@shared/print/print.service';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { DataTable, type TableColumn } from '@shared/ui/data-table/data-table';
import { DatePicker } from '@shared/ui/date-picker/date-picker';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { ReportsApi, type ReportSale } from '../../data-access/reports-api';
import { type ProductSummary, type SellerSummary, buildSalesReport, isSameDay } from '../../data-access/sales-report';
import { buildSalesReportHtml, reportTitle } from '../../data-access/sales-report-html';

const today = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Reportes de ventas para imprimir o guardar como PDF: el cierre de caja de un día o las ventas de un rango, con los
 * totales, lo vendido por cada vendedor y los productos que más salieron. Se calcula en el navegador con las ventas
 * que el servidor deja ver a cada rol (el ADMIN, de todas las sucursales o de una; el gerente, de la suya).
 */
@Component({
  selector: 'app-reports-page',
  imports: [Card, Button, DataTable, DatePicker, Select, LucideFileDown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  private readonly api = inject(ReportsApi);
  private readonly auth = inject(AuthStore);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly printer = inject(PrintService);
  private readonly company = inject(CompanyInfo);

  protected readonly storeIcon = LucideStore.icon;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  protected readonly sales = signal<readonly ReportSale[]>([]);
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly printing = signal(false);

  protected readonly from = signal<Date | null>(today());
  protected readonly to = signal<Date | null>(today());
  // Solo la sucursal se recuerda: las fechas arrancan siempre en hoy, que es lo que se espera de un cierre de caja.
  protected readonly branchFilter = persistedFilter('reports', 'branch', null as number | null, codecs.nullable(codecs.number()));

  protected readonly branchOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Todas las sucursales' },
    ...this.branches().map((b) => ({ value: b.id, label: b.nombre })),
  ]);

  protected readonly report = computed(() => {
    const from = this.from();
    const to = this.to();
    return from && to ? buildSalesReport(this.sales(), from, to) : null;
  });
  protected readonly title = computed(() => {
    const report = this.report();
    return report ? reportTitle(report) : 'Reporte de ventas';
  });
  protected readonly isToday = computed(() => {
    const from = this.from();
    const to = this.to();
    return !!from && !!to && isSameDay(from, today()) && isSameDay(to, today());
  });
  protected readonly isMonth = computed(() => {
    const from = this.from();
    const to = this.to();
    const now = today();
    return !!from && !!to && isSameDay(from, new Date(now.getFullYear(), now.getMonth(), 1)) && isSameDay(to, now);
  });

  /** Para qué sucursal(es) es el reporte: lo que se imprime bajo el título. */
  protected readonly branchLabel = computed(() => {
    const names = new Map(this.branches().map((b) => [b.id, b.nombre]));
    if (this.isAdmin()) {
      const id = this.branchFilter();
      return id === null ? 'Todas las sucursales' : (names.get(id) ?? `Sucursal ${id}`);
    }
    const own = this.auth.session()?.sucursalId;
    return (own !== undefined ? names.get(own) : undefined) ?? this.sales()[0]?.branchName ?? 'Mi sucursal';
  });

  protected readonly sellerColumns: readonly TableColumn<SellerSummary>[] = [
    { key: 'seller', header: 'Vendedor', primary: true, sortable: true },
    { key: 'sales', header: 'Ventas', align: 'end', sortable: true },
    { key: 'units', header: 'Unidades', align: 'end', sortable: true, display: (r) => formatQuantity(r.units) },
    { key: 'average', header: 'Ticket promedio', align: 'end', sortable: true, display: (r) => formatMoney(r.average), export: (r) => r.average },
    { key: 'total', header: 'Total', align: 'end', sortable: true, display: (r) => formatMoney(r.total), export: (r) => r.total },
  ];
  protected readonly productColumns: readonly TableColumn<ProductSummary>[] = [
    { key: 'name', header: 'Producto', primary: true, sortable: true },
    { key: 'units', header: 'Unidades', align: 'end', sortable: true, display: (r) => formatQuantity(r.units) },
    { key: 'total', header: 'Total', align: 'end', sortable: true, display: (r) => formatMoney(r.total), export: (r) => r.total },
  ];
  protected readonly sellerKey = (row: SellerSummary): string => row.seller;
  protected readonly productKey = (row: ProductSummary): string => row.name;

  /** Solo la última petición manda: al cambiar de sucursal rápido, la respuesta anterior no debe pisar la actual. */
  private loadId = 0;

  constructor() {
    void this.load();
    // Los nombres de las sucursales adornan el reporte: si no llegan, se usa lo que traen las ventas.
    this.branchApi
      .list()
      .pipe(catchError(() => of([])))
      .subscribe((branches) => this.branches.set(branches));
  }

  protected async load(): Promise<void> {
    const id = ++this.loadId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const sales = await firstValueFrom(this.api.sales(this.isAdmin() ? this.branchFilter() : null));
      if (id === this.loadId) this.sales.set(sales);
    } catch (error) {
      if (id === this.loadId) this.error.set(toApiError(error).message);
    } finally {
      if (id === this.loadId) this.loading.set(false);
    }
  }

  protected setBranch(branchId: number | null): void {
    this.branchFilter.set(branchId);
    void this.load();
  }

  protected useToday(): void {
    this.from.set(today());
    this.to.set(today());
  }

  protected useMonth(): void {
    const now = today();
    this.from.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.to.set(now);
  }

  /** Abre el diálogo de impresión con el reporte A4: ahí se imprime o se elige "Guardar como PDF". */
  protected async download(): Promise<void> {
    const report = this.report();
    if (!report || this.printing()) return;
    this.printing.set(true);
    try {
      this.printer.print(buildSalesReportHtml(report, await this.company.load(), this.branchLabel()));
    } finally {
      this.printing.set(false);
    }
  }

}
