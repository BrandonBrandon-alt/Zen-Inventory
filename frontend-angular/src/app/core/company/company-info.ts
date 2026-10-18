import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

/** Datos de la empresa para los documentos impresos; un texto vacío significa "no configurado". */
export interface Company {
  readonly name: string;
  readonly taxId: string;
  readonly address: string;
  readonly phone: string;
  readonly invoicePrefix: string;
  readonly invoiceFooter: string;
}

/** Lo que se imprime si el servidor no responde: la factura sale igual, solo sin los datos de la empresa. */
export const DEFAULT_COMPANY: Company = { name: 'Zen Inventory', taxId: '', address: '', phone: '', invoicePrefix: 'FV', invoiceFooter: '' };

const clean = (value: string | undefined, fallback = ''): string => value?.trim() || fallback;

/**
 * Datos de la empresa (los define cada despliegue en el backend). Se piden la primera vez que hacen falta y se
 * reutilizan; un fallo no se guarda, así el siguiente intento vuelve a preguntar.
 */
@Injectable({ providedIn: 'root' })
export class CompanyInfo {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private cached: Company | null = null;

  async load(): Promise<Company> {
    if (this.cached) return this.cached;
    try {
      const raw = await firstValueFrom(
        this.http.get<components['schemas']['CompanyResponse']>(`${this.baseUrl}/api/v1/company`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) }),
      );
      this.cached = {
        name: clean(raw.name, DEFAULT_COMPANY.name),
        taxId: clean(raw.taxId),
        address: clean(raw.address),
        phone: clean(raw.phone),
        invoicePrefix: clean(raw.invoicePrefix, DEFAULT_COMPANY.invoicePrefix),
        invoiceFooter: clean(raw.invoiceFooter),
      };
      return this.cached;
    } catch {
      return DEFAULT_COMPANY;
    }
  }
}
