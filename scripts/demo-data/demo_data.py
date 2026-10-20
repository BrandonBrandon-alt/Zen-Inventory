#!/usr/bin/env python3
"""Datos de demostración de una empresa en funcionamiento (meses de ventas, compras, traslados, devoluciones y alertas).

    python3 scripts/demo-data/demo_data.py load     # borra la demostración anterior y carga una nueva
    python3 scripts/demo-data/demo_data.py clean    # deja la base sin los datos de demostración
    python3 scripts/demo-data/demo_data.py sql > demo.sql   # solo genera el SQL (sin tocar la base)
    PGPASSWORD=… python3 scripts/demo-data/demo_data.py load --conn "host=… dbname=… user=… sslmode=require"   # una base remota (Neon…)

`sql` asume una base vacía (los ids empiezan en 1): si la base ya trae datos, como los de V2, usa `load`, que mira
el id máximo de cada tabla antes de generar.

Los usuarios de demostración son nombre.apellido@demo.zeninventory.co y admin@demo.zeninventory.co, todos con la
contraseña Demo-2026*. `clean` solo borra lo de la demostración; lo que se cree después con la aplicación se conserva.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from datetime import date

sys.path.insert(0, __file__.rsplit("/", 1)[0])

import catalog as C  # noqa: E402
from emit import clean_sql, load_sql  # noqa: E402
from generate import TABLES_WITH_OFFSETS, Sim  # noqa: E402

PSQL = ["docker", "exec", "-i", "{container}", "sh", "-c", 'psql -q -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"']


def psql_command(container: str, conn: str | None = None) -> list[str]:
    """El comando de psql: contra el contenedor de Docker o, con `conn`, contra una base remota (la clave va en PGPASSWORD)."""
    if conn:
        return ["psql", "-q", "-v", "ON_ERROR_STOP=1", "-At", conn]
    return [part.format(container=container) for part in PSQL]


# Se fija en main(): `--conn` cambia a qué base hablan todos los comandos.
CONN: str | None = None


def psql(container: str, sql: str) -> str:
    cmd = psql_command(container, CONN)
    result = subprocess.run(cmd, input=sql, text=True, capture_output=True)
    if result.returncode != 0:
        sys.exit(f"psql falló:\n{result.stderr.strip()}")
    return result.stdout


def current_offsets(container: str) -> dict[str, int]:
    query = " UNION ALL ".join(f"SELECT '{t}', COALESCE(MAX(id), 0) FROM public.{t}" for t in TABLES_WITH_OFFSETS)
    rows = psql(container, query).strip().splitlines()
    return {name: int(value) for name, value in (row.split("|") for row in rows)}


def simulate(args: argparse.Namespace, offsets: dict[str, int]) -> Sim:
    sim = Sim(date.fromisoformat(args.today) if args.today else date.today(), args.days, args.scale, args.seed, offsets)
    sim.run()
    return sim


def summary(container: str) -> None:
    tables = ["usuario", "sucursal", "producto", "proveedor", "inventario_local", "ventas", "detalles_venta", "ordenes_compra", "pagos_orden_compra", "transferencias",
              "solicitudes_devolucion", "movimiento_inventario", "alertas_stock"]
    query = " UNION ALL ".join(f"SELECT '{t}', COUNT(*) FROM public.{t}" for t in tables)
    print("\nFilas en la base ahora:")
    for row in psql(container, query).strip().splitlines():
        name, count = row.split("|")
        print(f"  {name:<24}{int(count):>9,}".replace(",", "."))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["load", "clean", "sql"])
    parser.add_argument("--days", type=int, default=180, help="días de historia (por defecto 180)")
    parser.add_argument("--scale", type=float, default=1.0, help="multiplica el volumen de ventas (por defecto 1)")
    parser.add_argument("--seed", type=int, default=42, help="semilla: la misma semilla da siempre los mismos datos")
    parser.add_argument("--today", help="fecha de hoy AAAA-MM-DD (por defecto, la del sistema)")
    parser.add_argument("--container", default="zenvory-db", help="contenedor de PostgreSQL")
    parser.add_argument("--conn", help='conexión a una base remota para psql (p. ej. "host=… dbname=… user=… sslmode=require"); la clave, en PGPASSWORD')
    args = parser.parse_args()
    global CONN
    CONN = args.conn

    if args.command == "clean":
        psql(args.container, clean_sql())
        print("Datos de demostración borrados.")
        summary(args.container)
        return
    if args.command == "sql":
        print(load_sql(simulate(args, {})))
        return

    started = time.time()
    print("Borrando la demostración anterior (si hay)…")
    psql(args.container, clean_sql())
    print("Simulando la empresa…")
    sim = simulate(args, current_offsets(args.container))
    sql = load_sql(sim)
    print(f"Cargando {len(sql) / 1_000_000:.1f} MB de SQL…")
    psql(args.container, sql)
    print(f"Listo en {time.time() - started:.0f} s.")
    summary(args.container)
    print(f"\nEntra con admin@{C.DEMO_EMAIL_DOMAIN} (o cualquier usuario @{C.DEMO_EMAIL_DOMAIN}), contraseña Demo-2026*")


if __name__ == "__main__":
    main()
