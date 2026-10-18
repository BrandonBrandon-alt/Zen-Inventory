import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { server, TEST_API } from '@testing/msw-server';
import { CompanyInfo, DEFAULT_COMPANY } from './company-info';

const URL_C = `${TEST_API}/api/v1/company`;

function service() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }] });
  return TestBed.inject(CompanyInfo);
}

describe('CompanyInfo', () => {
  it('trae los datos de la empresa, sin espacios sobrantes, y los reutiliza', async () => {
    let calls = 0;
    server.use(http.get(URL_C, () => (calls++, HttpResponse.json({ name: ' Zen S.A.S. ', taxId: '900', address: '', phone: ' 604 ', invoicePrefix: 'ZN', invoiceFooter: 'Gracias' }))));
    const info = service();
    expect(await info.load()).toEqual({ name: 'Zen S.A.S.', taxId: '900', address: '', phone: '604', invoicePrefix: 'ZN', invoiceFooter: 'Gracias' });
    await info.load();
    expect(calls).toBe(1);
  });

  it('si faltan el nombre o el prefijo usa los de siempre', async () => {
    server.use(http.get(URL_C, () => HttpResponse.json({ name: '', invoicePrefix: '' })));
    expect(await service().load()).toMatchObject({ name: DEFAULT_COMPANY.name, invoicePrefix: DEFAULT_COMPANY.invoicePrefix });
  });

  it('si el servidor falla devuelve los datos por defecto, sin avisar, y la próxima vez vuelve a preguntar', async () => {
    let fail = true;
    let calls = 0;
    server.use(http.get(URL_C, () => (calls++, fail ? HttpResponse.error() : HttpResponse.json({ name: 'Zen', invoicePrefix: 'FV' }))));
    const info = service();
    expect(await info.load()).toEqual(DEFAULT_COMPANY);
    fail = false;
    expect((await info.load()).name).toBe('Zen');
    expect(calls).toBe(2);
  });
});
