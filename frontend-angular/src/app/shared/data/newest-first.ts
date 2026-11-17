/**
 * Las tablas muestran arriba lo más reciente. El servidor devuelve estas listas sin orden (un registro editado puede
 * cambiar de lugar), así que se ordenan por id: el más alto es el último creado.
 */
export function newestFirst<T extends { readonly id: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.id - a.id);
}
