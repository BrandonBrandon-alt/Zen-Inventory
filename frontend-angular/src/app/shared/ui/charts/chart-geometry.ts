export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Padding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface AreaGeometry {
  readonly points: readonly Point[];
  /** Trazo de la línea (curva suave). */
  readonly line: string;
  /** Contorno cerrado hasta la base, para el relleno. */
  readonly area: string;
  /** Valor máximo del eje (con holgura arriba para que la línea no toque el borde). */
  readonly max: number;
}

const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/**
 * Curva suave que pasa por todos los puntos sin "rebotar" por encima o por debajo de ellos (spline cúbica
 * monótona, Fritsch–Carlson): una serie de ingresos nunca debe parecer tener un valor que no tuvo.
 */
export function monotonePath(points: readonly Point[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${f(points[0].x)},${f(points[0].y)}`;
  if (n === 2) return `M${f(points[0].x)},${f(points[0].y)}L${f(points[1].x)},${f(points[1].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push((points[i + 1].y - points[i].y) / (dx[i] || 1));
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  }
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const norm = Math.hypot(a, b);
    if (norm > 3) {
      tangent[i] = (3 * a * slope[i]) / norm;
      tangent[i + 1] = (3 * b * slope[i]) / norm;
    }
  }

  let path = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const step = dx[i] / 3;
    path += `C${f(points[i].x + step)},${f(points[i].y + tangent[i] * step)} ${f(points[i + 1].x - step)},${f(points[i + 1].y - tangent[i + 1] * step)} ${f(points[i + 1].x)},${f(points[i + 1].y)}`;
  }
  return path;
}

/** Puntos, línea y relleno de una serie dentro de `width` × `height`. El eje vertical parte siempre de cero. */
export function buildAreaGeometry(values: readonly number[], width: number, height: number, pad: Padding): AreaGeometry {
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const baseline = pad.top + innerHeight;
  const peak = Math.max(0, ...values);
  const max = peak === 0 ? 1 : peak * 1.1;

  const points = values.map((value, i) => ({
    x: pad.left + (values.length === 1 ? innerWidth / 2 : (innerWidth * i) / (values.length - 1)),
    y: baseline - (Math.max(0, value) / max) * innerHeight,
  }));
  const line = monotonePath(points);
  const area = points.length < 2 ? '' : `${line}L${f(points[points.length - 1].x)},${f(baseline)}L${f(points[0].x)},${f(baseline)}Z`;
  return { points, line, area, max };
}

/** Índice del punto más cercano a una coordenada horizontal (en unidades del viewBox). */
export function nearestIndex(points: readonly Point[], x: number): number {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  points.forEach((point, i) => {
    const d = Math.abs(point.x - x);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}
