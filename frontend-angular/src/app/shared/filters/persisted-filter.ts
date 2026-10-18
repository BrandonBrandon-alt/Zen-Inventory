import { type WritableSignal, effect, inject, signal } from '@angular/core';
import { AuthStore } from '@core/auth/session/auth-store';

/** Cómo se lee un valor guardado: devuelve `undefined` si no sirve (dato viejo o alterado), y entonces se usa el inicial. */
export interface FilterCodec<T> {
  parse(raw: unknown): T | undefined;
}

const text = (max = 200): FilterCodec<string> => ({ parse: (raw) => (typeof raw === 'string' && raw.length <= max ? raw : undefined) });
const bool = (): FilterCodec<boolean> => ({ parse: (raw) => (typeof raw === 'boolean' ? raw : undefined) });
const oneOf = <T extends string>(values: readonly T[]): FilterCodec<T> => ({ parse: (raw) => values.find((v) => v === raw) });
const nullable = <T>(inner: FilterCodec<T>): FilterCodec<T | null> => ({ parse: (raw) => (raw === null ? null : inner.parse(raw)) });
const finite = (): FilterCodec<number> => ({ parse: (raw) => (typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined) });
const date = (): FilterCodec<Date> => ({
  parse: (raw) => {
    if (typeof raw !== 'string') return undefined;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  },
});

/** Lectores de valores guardados, para armar el de cada filtro: `codecs.nullable(codecs.number())`. */
export const codecs = { text, bool, oneOf, nullable, number: finite, date };

const PREFIX = 'zen:filters';

function readAll(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeAll(key: string, all: Record<string, unknown>): void {
  try {
    if (Object.keys(all).length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* sin almacenamiento (modo privado, cuota llena): el filtro sigue funcionando, solo no se recuerda */
  }
}

/**
 * Un filtro que se recuerda entre visitas. Cada persona tiene los suyos por pantalla (`zen:filters:<usuario>:<pantalla>`),
 * así que en un equipo compartido no se mezclan. Solo se guarda lo que difiere del valor inicial; un valor guardado que
 * ya no sirve (formato viejo, opción que no existe) se descarta. Sin sesión, funciona pero no recuerda nada.
 * Se llama en un contexto de inyección (campo de un componente).
 */
export function persistedFilter<T>(screen: string, name: string, initial: T, codec: FilterCodec<T>): WritableSignal<T> {
  const userId = inject(AuthStore).session()?.id;
  const key = userId === undefined ? null : `${PREFIX}:${userId}:${screen}`;
  const stored = key === null ? undefined : codec.parse(readAll(key)[name]);
  const state = signal<T>(stored === undefined ? initial : stored);

  if (key !== null) {
    const initialJson = JSON.stringify(initial);
    effect(() => {
      const json = JSON.stringify(state());
      const all = readAll(key);
      if (json === initialJson) delete all[name];
      else all[name] = JSON.parse(json) as unknown;
      writeAll(key, all);
    });
  }
  return state;
}
