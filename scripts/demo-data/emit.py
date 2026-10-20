"""Convierte el resultado de la simulación en SQL (COPY) y arma el SQL de limpieza."""

from __future__ import annotations

import re
from datetime import datetime, timedelta

import catalog as C
from generate import Sim

SERIAL_TABLES = (
    "unidad_medida", "sucursal", "usuario", "proveedor", "producto", "producto_proveedor", "producto_unidad", "precio_por_lista",
    "rutas_logisticas", "inventario_local", "ventas", "detalles_venta", "ordenes_compra", "detalles_orden_compra", "pagos_orden_compra", "transferencias",
    "detalles_transferencia", "solicitudes_devolucion", "detalles_devolucion_solicitud", "movimiento_inventario", "alertas_stock",
)


def _ts(value: datetime | None) -> str:
    return "\\N" if value is None else value.strftime("%Y-%m-%d %H:%M:%S")


def _cell(value) -> str:
    if value is None:
        return "\\N"
    if isinstance(value, bool):
        return "t" if value else "f"
    if isinstance(value, datetime):
        return _ts(value)
    if isinstance(value, float):
        text = f"{value:.4f}".rstrip("0").rstrip(".")
        return text if text not in ("", "-0") else "0"
    return str(value).replace("\\", "\\\\").replace("\t", " ").replace("\n", " ").replace("\r", " ")


class Writer:
    def __init__(self) -> None:
        self.parts: list[str] = []

    def copy(self, table: str, columns: str, rows: list[tuple]) -> None:
        if not rows:
            return
        self.parts.append(f"COPY public.{table} ({columns}) FROM STDIN;\n")
        self.parts.append("".join("\t".join(_cell(v) for v in row) + "\n" for row in rows))
        self.parts.append("\\.\n\n")

    def text(self) -> str:
        return "".join(self.parts)


def person_ref(person) -> tuple:
    return (person.id, person.name) if person is not None else (None, None)


def load_sql(sim: Sim) -> str:
    w = Writer()
    w.parts.append("-- Datos de demostración generados por scripts/demo-data (no editar a mano)\nBEGIN;\nSET client_encoding = 'UTF8';\n\n")
    start = datetime.combine(sim.start, datetime.min.time()) - timedelta(days=60)
    names = {**C.EXISTING_BRANCHES, **{b[0]: b[1] for b in C.NEW_BRANCHES}}

    w.copy("unidad_medida", "id, nombre, abreviatura", [(uid, name, abbr) for uid, name, abbr in C.NEW_UNITS])
    w.copy("sucursal", "id, nombre, direccion, telefono, activa, created_at", [(i, n, a, t, act, start) for i, n, a, t, act in C.NEW_BRANCHES])
    w.copy("usuario", "id, nombre, email, password_hash, rol_id, sucursal_id, created_at, activa",
           [(u.id, u.name, u.email, C.PASSWORD_HASH, u.role_id, u.branch_id, start + timedelta(days=(u.id % 40)), u.active) for u in sim.users])
    w.copy("proveedor", "id, nombre, contacto, tiempo_entrega_dias", [(i, n, c, d) for i, n, c, d, _g in C.SUPPLIERS])

    products = sim.products
    w.copy("producto", "id, sku, nombre, costo_promedio, precio_venta, created_at, unidad_id, activa",
           [(p.id, f"{p.cat}-{p.id - C.PRODUCT_ID_START + 1:03d}", p.name, p.cpp, p.price, start, C.UNIT_IDS[p.unit], p.active) for p in products.values()])
    rows = []
    for p in products.values():
        for supplier, price, preferred in sim.suppliers_of[p.id]:
            rows.append((sim.next_id("producto_proveedor"), p.id, supplier, f"PRV{supplier}-{p.id:04d}", round(price, 2), sim.supplier_days[supplier], preferred))
    w.copy("producto_proveedor", "id, producto_id, proveedor_id, sku_proveedor, precio_pactado, tiempo_entrega_dias, preferido", rows)
    rows = []
    for p in products.values():
        rows.append((sim.next_id("producto_unidad"), p.id, C.UNIT_IDS[p.unit], 1.0, True))
        m = re.search(r"(\d+(?:,\d+)?)Kg", p.name)
        if m and p.unit == "BTO":
            rows.append((sim.next_id("producto_unidad"), p.id, C.UNIT_IDS["KG"], round(1 / float(m.group(1).replace(",", ".")), 4), False))
    w.copy("producto_unidad", "id, producto_id, unidad_id, factor_conversion, es_base", rows)
    rows = []
    for p in products.values():
        if p.active:
            for list_id, factor in ((1, 1.0), (2, 0.92), (3, 0.95)):
                rows.append((sim.next_id("precio_por_lista"), list_id, p.id, round(p.price * factor / 50) * 50.0))
    w.copy("precio_por_lista", "id, lista_id, producto_id, precio", rows)
    rows = []
    for a in sim.branches:
        for b in sim.branches:
            # Las rutas entre las tres sucursales de siempre ya existen en la base.
            if a != b and not (a in C.EXISTING_BRANCHES and b in C.EXISTING_BRANCHES):
                rows.append((sim.next_id("rutas_logisticas"), a, b, 2 + (abs(a - b) * 3) % 9, float(12000 + (abs(a - b) * 7000) % 60000)))
    w.copy("rutas_logisticas", "id, sucursal_origen_id, sucursal_destino_id, tiempo_estimado_horas, costo_flete_estimado", rows)

    w.copy("inventario_local", "id, sucursal_id, producto_id, cantidad_actual, stock_minimo, last_updated, stock_comprometido",
           [(sim.next_id("inventario_local"), b, p, round(i.stock, 4), i.minimum, i.last_update or start, i.reserved) for (b, p), i in sorted(sim.items.items())])

    sellers = sim.by_id
    w.copy("ventas", "id, sucursal_id, usuario_id, fecha, subtotal, descuento_total, total_final, created_at, estado, motivo_anulacion, cliente_nombre, cliente_documento, sucursal_nombre, vendedor_nombre, global_discount_percentage, metodo_pago, referencia_pago",
           [(s["id"], s["branch"], s["user"], s["ts"], s["subtotal"], s["discount"], s["total"], s["ts"], s["status"], s["reason"], s["customer"], s["doc"],
             names[s["branch"]], sellers[s["user"]].name, float(s["global"]), s["pay_method"], s["pay_ref"]) for s in sim.rows["ventas"]])
    w.copy("detalles_venta", "id, venta_id, producto_id, cantidad, precio_unitario_aplicado, porcentaje_descuento, subtotal_linea, producto_nombre",
           [(d[0], d[1], d[2], d[3], d[4], float(d[5]), d[6], d[7]) for d in sim.rows["detalles_venta"]])

    w.copy("ordenes_compra", "id, proveedor_id, sucursal_id, usuario_id, usuario_recepcion_id, fecha_solicitud, fecha_estimada_llegada, fecha_real_llegada, estado_recepcion, estado_pago, total, created_at, fecha_vencimiento_pago, plazo_pago_dias, version, motivo_resolucion, resuelto_por_id, fecha_resolucion, excepcion_aprobada, tiempo_entrega_dias",
           [(o["id"], o["supplier"], o["branch"], o["user"], o["receiver"], o["ts"], o["eta"], o["arrived"], o["status"], o["pay"], o["total"], o["ts"],
             o["due"] or (o["ts"] + timedelta(days=o["plazo"])), o["plazo"], 0, o["note"], o["resolver"], o["resolved_ts"], False, o["lead"]) for o in sim.rows["ordenes_compra"]])
    w.copy("detalles_orden_compra", "id, orden_id, producto_id, cantidad, precio_unitario_pactado, subtotal, descuento_pct, cantidad_recibida",
           [(l["id"], l["order"], l["prod"], l["qty"], l["price"], l["sub"], float(l["disc"]), l["got"]) for l in sim.rows["detalles_orden_compra"]])
    w.copy("pagos_orden_compra", "id, orden_id, monto, fecha, usuario_id, usuario_nombre, metodo, referencia, notas",
           [(p["id"], p["order"], p["amount"], p["ts"], p["user"], sellers[p["user"]].name, p["method"], p["ref"], p["note"]) for p in sim.rows["pagos_orden_compra"]])

    def p(person):
        return person_ref(person)

    rows = []
    for t in sim.rows["transferencias"]:
        rows.append((t["id"], t["status"], t["ts"], t["eta"], t["arrived"], t["origin"], t["dest"], t["carrier"], t["notes"], t["parent"], 0, t["reason"],
                     p(t["resolver"])[0], t["resolved_ts"], t["priority"], t["cost"], t["guide"], t["dispatch_ts"], *p(t["requester"]), *p(t["authorizer"]),
                     *p(t["dispatcher"]), *p(t["receiver"]), *p(t["resolver"])))
    w.copy("transferencias", "id, estado, fecha_solicitud, fecha_estimada_llegada, fecha_real_llegada, sucursal_origen_id, sucursal_destino_id, transportista, notas_recepcion, parent_transfer_id, version, motivo_resolucion, resuelto_por_id, fecha_resolucion, prioridad, costo_envio, numero_guia, fecha_despacho, solicitante_id, solicitante_nombre, autorizador_id, autorizador_nombre, despachador_id, despachador_nombre, recibidor_id, recibidor_nombre, resolutor_id, resolutor_nombre", rows)
    w.copy("detalles_transferencia", "id, transferencia_id, producto_id, cantidad_solicitada, cantidad_enviada, cantidad_recibida, faltantes, producto_nombre",
           [(l["id"], l["transfer"], l["prod"], l["req"], l["sent"], l["got"], l["missing"], products[l["prod"]].name) for l in sim.rows["detalles_transferencia"]])

    w.copy("solicitudes_devolucion", "id, venta_id, sucursal_id, solicitante_id, aprobador_id, estado, fecha_solicitud, fecha_procesamiento, motivo_general, comentario_aprobador, created_at",
           [(r["id"], r["sale"], r["branch"], r["requester"], r["approver"], r["status"], r["ts"], r["done"], r["reason"], r["comment"], r["ts"]) for r in sim.rows["solicitudes_devolucion"]])
    w.copy("detalles_devolucion_solicitud", "id, solicitud_id, producto_id, cantidad, motivo_especifico, precio_unidad_venta", list(sim.rows["detalles_devolucion_solicitud"]))

    moves = sorted(sim.rows["movimiento_inventario"], key=lambda m: (m[0], m[1]))
    w.copy("movimiento_inventario", "id, tipo, motivo, cantidad, fecha, producto_id, sucursal_id, usuario_id, referencia_id, tipo_referencia, saldo_final, observaciones, sub_motivo",
           [(sim.next_id("movimiento_inventario"), m[2], m[3], m[4], m[0], m[5], m[6], m[7], m[8], m[9], m[10], m[11], m[12]) for m in moves])
    w.copy("alertas_stock", "id, sucursal_id, producto_id, mensaje, fecha_alerta, resuelta, tipo_resolucion, referencia_id, motivo_descarte, fecha_resolucion, tipo_alerta",
           [(a["id"], a["branch"], a["prod"], a["msg"], a["ts"], a["resolved"], a["res_type"], a["ref"], a["why"], a["res_ts"], a["type"]) for a in sim.rows["alertas_stock"]])

    for table in SERIAL_TABLES:
        w.parts.append(f"SELECT setval(pg_get_serial_sequence('public.{table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.{table}));\n")
    w.parts.append("COMMIT;\n")
    return w.text()


def clean_sql() -> str:
    first, last = C.FIRST_DEMO_PRODUCT, C.LAST_DEMO_PRODUCT
    branches = ", ".join(str(b[0]) for b in C.NEW_BRANCHES)
    unit_ids = ", ".join(str(u[0]) for u in C.NEW_UNITS)
    suppliers = f"{C.SUPPLIERS[0][0]} AND {C.SUPPLIERS[-1][0]}"
    return f"""-- Borra los datos de demostración (usuarios @{C.DEMO_EMAIL_DOMAIN}, productos {first}-{last}, sucursales {branches}) y todo lo que hicieron.
BEGIN;
CREATE TEMP TABLE d_users ON COMMIT DROP AS SELECT id FROM public.usuario WHERE email LIKE '%@{C.DEMO_EMAIL_DOMAIN}';
CREATE TEMP TABLE d_sales ON COMMIT DROP AS SELECT id FROM public.ventas WHERE usuario_id IN (SELECT id FROM d_users) OR sucursal_id IN ({branches});
CREATE TEMP TABLE d_returns ON COMMIT DROP AS SELECT id FROM public.solicitudes_devolucion WHERE venta_id IN (SELECT id FROM d_sales) OR solicitante_id IN (SELECT id FROM d_users);
DELETE FROM public.detalles_devolucion_solicitud WHERE solicitud_id IN (SELECT id FROM d_returns);
DELETE FROM public.solicitudes_devolucion WHERE id IN (SELECT id FROM d_returns);
DELETE FROM public.detalles_venta WHERE venta_id IN (SELECT id FROM d_sales);
DELETE FROM public.ventas WHERE id IN (SELECT id FROM d_sales);
CREATE TEMP TABLE d_transfers ON COMMIT DROP AS SELECT id FROM public.transferencias WHERE solicitante_id IN (SELECT id FROM d_users) OR sucursal_origen_id IN ({branches}) OR sucursal_destino_id IN ({branches});
UPDATE public.transferencias SET parent_transfer_id = NULL WHERE parent_transfer_id IN (SELECT id FROM d_transfers);
DELETE FROM public.detalles_transferencia WHERE transferencia_id IN (SELECT id FROM d_transfers);
DELETE FROM public.transferencias WHERE id IN (SELECT id FROM d_transfers);
CREATE TEMP TABLE d_orders ON COMMIT DROP AS SELECT id FROM public.ordenes_compra WHERE usuario_id IN (SELECT id FROM d_users) OR sucursal_id IN ({branches});
DELETE FROM public.pagos_orden_compra WHERE orden_id IN (SELECT id FROM d_orders);
DELETE FROM public.detalles_orden_compra WHERE orden_id IN (SELECT id FROM d_orders);
DELETE FROM public.ordenes_compra WHERE id IN (SELECT id FROM d_orders);
DELETE FROM public.alertas_stock WHERE producto_id BETWEEN {first} AND {last} OR sucursal_id IN ({branches});
DELETE FROM public.movimiento_inventario WHERE usuario_id IN (SELECT id FROM d_users) OR producto_id BETWEEN {first} AND {last};
DELETE FROM public.inventario_local WHERE producto_id BETWEEN {first} AND {last} OR sucursal_id IN ({branches});
DELETE FROM public.precio_por_lista WHERE producto_id BETWEEN {first} AND {last};
DELETE FROM public.producto_proveedor WHERE producto_id BETWEEN {first} AND {last};
DELETE FROM public.producto_unidad WHERE producto_id BETWEEN {first} AND {last};
DELETE FROM public.producto WHERE id BETWEEN {first} AND {last};
DELETE FROM public.proveedor WHERE id BETWEEN {suppliers};
DELETE FROM public.unidad_medida WHERE id IN ({unit_ids});
DELETE FROM public.rutas_logisticas WHERE sucursal_origen_id IN ({branches}) OR sucursal_destino_id IN ({branches});
DELETE FROM public.usuario_avatar WHERE usuario_id IN (SELECT id FROM d_users);
DELETE FROM public.usuario WHERE id IN (SELECT id FROM d_users);
DELETE FROM public.sucursal WHERE id IN ({branches});
COMMIT;
"""
