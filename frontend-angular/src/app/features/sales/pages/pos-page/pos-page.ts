import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { LucideHash, LucideIdCard, LucidePackage, LucidePercent, LucidePlus, LucideReceipt, LucideSearch, LucideStore, LucideTag, LucideTrash2, LucideUserRound } from '@lucide/angular';
import { toApiError } from '@core/api/api-error';
import { AuthStore } from '@core/auth/session/auth-store';
import { type BranchOption, BranchOptionsApi } from '@core/branches/branch-options-api';
import { formatMoney, formatQuantity } from '@shared/format/format';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Card } from '@shared/ui/card/card';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { FormField, InputDirective } from '@shared/ui/form-field/form-field';
import { Select, type SelectOption } from '@shared/ui/select/select';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Tooltip } from '@shared/ui/tooltip/tooltip';
import { SaleDetailModal } from '../../components/sale-detail-modal/sale-detail-modal';
import { type PosProduct, type PriceListOption, type Sale, SalesApi } from '../../data-access/sales-api';

/** Una línea del carrito: lo que el cajero decide (producto, cantidad y descuento). El precio sale del catálogo. */
interface CartLine {
  readonly productId: number;
  readonly quantity: number | null;
  readonly discount: number | null;
}

/** Línea del carrito ya con su precio, su subtotal y, si no se puede vender así, por qué. */
interface CartRow extends CartLine {
  readonly product: PosProduct;
  readonly unitPrice: number;
  readonly subtotal: number;
  readonly problem: string | null;
}

const MAX_RESULTS = 40;
const round = (value: number): number => Math.round(value * 100) / 100;
/** Minúsculas y sin acentos: "tuerca" encuentra "Tuérca". */
const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

@Component({
  selector: 'app-pos-page',
  imports: [
    Alert,
    Button,
    Card,
    EmptyState,
    FormField,
    InputDirective,
    Select,
    Spinner,
    Tooltip,
    SaleDetailModal,
    LucideHash,
    LucideIdCard,
    LucidePercent,
    LucidePlus,
    LucideReceipt,
    LucideSearch,
    LucideTrash2,
    LucideUserRound,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block p-(--page-padding)' },
  templateUrl: './pos-page.html',
})
export class PosPage {
  private readonly api = inject(SalesApi);
  private readonly branchApi = inject(BranchOptionsApi);
  private readonly auth = inject(AuthStore);

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly storeIcon = LucideStore.icon;
  protected readonly tagIcon = LucideTag.icon;
  protected readonly packageIcon = LucidePackage.icon;

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');
  private readonly ownBranch = computed(() => this.auth.session()?.sucursalId ?? null);

  // ---- Catálogo ----
  protected readonly branches = signal<readonly BranchOption[]>([]);
  protected readonly chosenBranch = signal<number | null>(null);
  /** Sucursal desde la que se vende: la propia o, para el ADMIN, la que elija. */
  protected readonly branchId = computed(() => (this.isAdmin() ? this.chosenBranch() : this.ownBranch()));
  protected readonly products = signal<readonly PosProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly search = signal('');

  // ---- Venta ----
  protected readonly cart = signal<readonly CartLine[]>([]);
  protected readonly customerName = signal('');
  protected readonly customerDocument = signal('');
  protected readonly globalDiscount = signal<number | null>(0);
  protected readonly priceLists = signal<readonly PriceListOption[]>([]);
  protected readonly priceListId = signal<number | null>(null);
  private readonly listPrices = signal<ReadonlyMap<number, number>>(new Map());

  protected readonly submitting = signal(false);
  protected readonly saleError = signal<string | null>(null);
  protected readonly receiptOpen = signal(false);
  protected readonly lastSale = signal<Sale | null>(null);

  protected readonly branchOptions = computed<SelectOption<number>[]>(() =>
    this.branches().filter((b) => b.activa).map((b) => ({ value: b.id, label: b.nombre })),
  );
  protected readonly priceListOptions = computed<SelectOption<number | null>[]>(() => [
    { value: null, label: 'Precio normal' },
    ...this.priceLists().map((l) => ({ value: l.id, label: l.name, description: l.description || undefined })),
  ]);

  protected readonly results = computed(() => {
    const needle = normalize(this.search().trim());
    const all = this.products();
    const matches = needle ? all.filter((p) => normalize(p.name).includes(needle) || normalize(p.sku).includes(needle)) : all;
    return matches.slice(0, MAX_RESULTS);
  });
  protected readonly truncated = computed(() => {
    const needle = normalize(this.search().trim());
    const total = needle ? this.products().filter((p) => normalize(p.name).includes(needle) || normalize(p.sku).includes(needle)).length : this.products().length;
    return total > MAX_RESULTS ? total - MAX_RESULTS : 0;
  });

  protected readonly rows = computed<CartRow[]>(() => {
    const byId = new Map(this.products().map((p) => [p.id, p]));
    const prices = this.listPrices();
    return this.cart().flatMap((line): CartRow[] => {
      const product = byId.get(line.productId);
      if (!product) return [];
      const unitPrice = prices.get(product.id) ?? product.price;
      const quantity = line.quantity ?? 0;
      const discount = line.discount ?? 0;
      let problem: string | null = null;
      if (!Number.isInteger(quantity) || quantity < 1) problem = 'La cantidad debe ser un número entero de 1 en adelante.';
      else if (quantity > product.stock) problem = `Solo hay ${formatQuantity(product.stock)} en stock.`;
      else if (discount < 0 || discount > 100) problem = 'El descuento va de 0 a 100.';
      return [{ ...line, product, unitPrice, subtotal: round(unitPrice * quantity * (1 - discount / 100)), problem }];
    });
  });

  protected readonly subtotal = computed(() => round(this.rows().reduce((sum, r) => sum + r.subtotal, 0)));
  protected readonly globalDiscountAmount = computed(() => round((this.subtotal() * (this.globalDiscount() ?? 0)) / 100));
  protected readonly total = computed(() => round(this.subtotal() - this.globalDiscountAmount()));
  protected readonly units = computed(() => this.rows().reduce((sum, r) => sum + (r.quantity ?? 0), 0));
  protected readonly invalid = computed(() => {
    const global = this.globalDiscount() ?? 0;
    return this.rows().length === 0 || this.rows().some((r) => r.problem !== null) || global < 0 || global > 100;
  });

  constructor() {
    if (this.isAdmin()) {
      this.branchApi
        .list()
        .pipe(catchError(() => of([])))
        .subscribe((branches) => {
          this.branches.set(branches);
          const first = branches.find((b) => b.activa) ?? branches[0];
          if (first) this.chosenBranch.set(first.id);
          else this.loading.set(false);
        });
    }
    // Cada vez que cambia la sucursal desde la que se vende se carga su catálogo con su stock (y el carrito parte de cero).
    effect(() => {
      const branch = this.branchId();
      untracked(() => {
        this.cart.set([]);
        if (branch !== null) void this.loadCatalog(branch);
        else if (!this.isAdmin()) {
          this.loadError.set('Tu usuario no tiene una sucursal asignada.');
          this.loading.set(false);
        }
      });
    });
    this.api.priceLists().subscribe((lists) => this.priceLists.set(lists));
  }

  protected setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Enter en el buscador: agrega el producto si la búsqueda lo identifica (un solo resultado o un SKU exacto, como un lector de códigos). */
  protected addFirst(): void {
    const needle = normalize(this.search().trim());
    if (!needle) return;
    const results = this.results();
    const exact = results.find((p) => normalize(p.sku) === needle);
    const pick = exact ?? (results.length === 1 ? results[0] : null);
    if (pick && pick.stock > 0) {
      this.add(pick);
      this.search.set('');
    }
  }

  protected add(product: PosProduct): void {
    if (product.stock <= 0) return;
    this.cart.update((cart) => {
      const existing = cart.find((l) => l.productId === product.id);
      if (!existing) return [...cart, { productId: product.id, quantity: 1, discount: 0 }];
      return cart.map((l) => (l.productId === product.id ? { ...l, quantity: Math.min((l.quantity ?? 0) + 1, product.stock) } : l));
    });
  }

  protected setQuantity(productId: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.cart.update((cart) => cart.map((l) => (l.productId === productId ? { ...l, quantity: raw === '' ? null : Number(raw) } : l)));
  }

  protected setDiscount(productId: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.cart.update((cart) => cart.map((l) => (l.productId === productId ? { ...l, discount: raw === '' ? null : Number(raw) } : l)));
  }

  protected remove(productId: number): void {
    this.cart.update((cart) => cart.filter((l) => l.productId !== productId));
  }

  protected clear(): void {
    this.cart.set([]);
    this.saleError.set(null);
  }

  protected setGlobalDiscount(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.globalDiscount.set(raw === '' ? null : Number(raw));
  }

  protected async choosePriceList(id: number | null): Promise<void> {
    this.priceListId.set(id);
    if (id === null) {
      this.listPrices.set(new Map());
      return;
    }
    try {
      this.listPrices.set(await firstValueFrom(this.api.prices(id)));
    } catch (error) {
      this.priceListId.set(null);
      this.listPrices.set(new Map());
      this.saleError.set(toApiError(error).message);
    }
  }

  protected async submit(): Promise<void> {
    const branch = this.branchId();
    const userId = this.auth.session()?.id;
    if (branch === null || userId === undefined || this.invalid() || this.submitting()) return;
    this.submitting.set(true);
    this.saleError.set(null);
    try {
      const sale = await firstValueFrom(
        this.api.create({
          branchId: branch,
          userId,
          customerName: this.customerName(),
          customerDocument: this.customerDocument(),
          globalDiscountPct: this.globalDiscount() ?? 0,
          priceListId: this.priceListId(),
          items: this.rows().map((r) => ({ productId: r.productId, quantity: r.quantity ?? 0, discountPct: r.discount ?? 0 })),
        }),
      );
      this.lastSale.set(sale);
      this.receiptOpen.set(true);
      this.cart.set([]);
      this.customerName.set('');
      this.customerDocument.set('');
      this.globalDiscount.set(0);
      // El stock cambió: se vuelve a pedir el catálogo sin esperar a que el cajero lo note.
      void this.loadCatalog(branch, true);
    } catch (error) {
      this.saleError.set(toApiError(error).message);
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadCatalog(branch: number, silent = false): Promise<void> {
    if (!silent) this.loading.set(true);
    this.loadError.set(null);
    try {
      this.products.set(await firstValueFrom(this.api.catalog(branch)));
    } catch (error) {
      this.loadError.set(toApiError(error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
