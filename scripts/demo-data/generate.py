"""Simulador de una empresa en funcionamiento: genera el SQL con meses de historia coherente.

Todo se simula día a día y en orden cronológico, así que lo que queda en la base respeta las reglas de la aplicación:
el stock de cada sucursal es la suma de sus movimientos (con su saldo final), las compras recibidas mueven el costo
promedio con la misma fórmula del backend, un traslado descuenta del origen al despacharse y suma al destino al
recibirse, una venta anulada o una devolución aprobada devuelven el stock, y las alertas nacen cuando el stock cae al
mínimo. Con la misma semilla sale siempre lo mismo.
"""

from __future__ import annotations

import heapq
import itertools
import math
import random
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import catalog as C

TABLES_WITH_OFFSETS = (
    "ventas",
    "detalles_venta",
    "ordenes_compra",
    "detalles_orden_compra",
    "pagos_orden_compra",
    "transferencias",
    "detalles_transferencia",
    "pagos_traslado",
    "solicitudes_devolucion",
    "detalles_devolucion_solicitud",
    "alertas_stock",
    "movimiento_inventario",
    "inventario_local",
    "producto_proveedor",
    "producto_unidad",
    "precio_por_lista",
    "rutas_logisticas",
)

REASONS_CANCEL = [
    "Error de digitación del vendedor", "El cliente se arrepintió de la compra", "Producto equivocado en la factura",
    "Cliente sin fondos suficientes", "Precio mal aplicado", "Venta duplicada por error del sistema",
]
REASONS_RETURN = [
    "Producto defectuoso", "Referencia equivocada", "Producto en mal estado al abrir", "El cliente compró de más",
    "No cumple las especificaciones de la obra", "Llegó dañado por el transporte",
]
SHRINKAGE = [
    ("CADUCIDAD", "Producto vencido encontrado en el conteo de bodega"), ("DAÑO_FISICO", "Bultos rotos al descargar el camión"),
    ("DAÑO_FISICO", "Mercancía golpeada en el montacargas, no se puede vender"), ("ROBO_PERDIDA", "Faltante detectado en el inventario cíclico"),
    ("DEFECTO_FABRICA", "Lote con defecto de fábrica, se reclama al proveedor"), ("DAÑO_FISICO", "Humedad por filtración en la bodega"),
]
COUNT_NOTES = [
    "Conteo físico del cierre de mes: diferencia encontrada", "Ajuste tras el inventario cíclico de la semana",
    "Corrección de existencias por recuento en estantería", "Diferencia hallada al auditar la bodega principal",
]
CARRIERS = ["Servientrega", "Coordinadora", "TCC", "Envía", "Transporte propio", "Interrapidísimo"]
DISMISS_REASONS = ["Producto descontinuado", "Ya está en camino un pedido del proveedor", "Temporada baja, no se repone", "Error de conteo"]


def money(x: float) -> float:
    return round(x + 1e-9, 2)


@dataclass
class Person:
    id: int
    name: str
    email: str
    role_id: int
    branch_id: int | None
    active: bool = True


@dataclass
class Prod:
    id: int
    cat: str
    name: str
    unit: str
    cost0: float
    margin: float
    active: bool
    price: float = 0.0
    cpp: float = 0.0
    weight: float = 1.0
    qty_range: tuple[int, int] = (1, 5)
    multiple: int = 1


@dataclass
class Item:
    """Un producto en una sucursal."""

    stock: float = 0.0
    minimum: float = 0.0
    reserved: float = 0.0
    demand: float = 0.0  # unidades por día esperadas
    on_order: float = 0.0
    last_update: datetime | None = None
    alert: dict | None = None


class Sim:
    def __init__(self, today: date, days: int, scale: float, seed: int, offsets: dict[str, int]):
        self.rng = random.Random(seed)
        self.today = today
        self.now = datetime(today.year, today.month, today.day, 15, 40)
        self.start = today - timedelta(days=days)
        self.scale = scale
        self.off = {t: offsets.get(t, 0) for t in TABLES_WITH_OFFSETS}
        self.counters: dict[str, int] = defaultdict(int)
        self.seq = itertools.count()
        self.heap: list = []
        self.rows: dict[str, list[tuple]] = defaultdict(list)
        self.sales: dict[int, dict] = {}
        self.orders: dict[int, dict] = {}
        self.transfers: dict[int, dict] = {}
        self.returns: dict[int, dict] = {}
        self.users: list[Person] = []
        self.products: dict[int, Prod] = {}
        self.items: dict[tuple[int, int], Item] = {}
        self.branches = list(C.BRANCH_SIZE)
        self.total_stock: dict[int, float] = defaultdict(float)
        self.suppliers_of: dict[int, list[tuple[int, float, bool]]] = {}
        self.open_orders: dict[tuple[int, int], int] = {}
        self.customers: list[tuple[str, str]] = []
        self._build_people()
        self._build_catalog()
        self._build_customers()
        self._build_items()

    # ------------------------------------------------------------------ ids
    def next_id(self, table: str) -> int:
        self.counters[table] += 1
        return self.off.get(table, 0) + self.counters[table]

    def schedule(self, ts: datetime, kind: str, **payload) -> None:
        heapq.heappush(self.heap, (ts, next(self.seq), kind, payload))

    # ------------------------------------------------------------------ maestros
    def _build_people(self) -> None:
        rng = self.rng
        used: set[str] = set()
        uid = itertools.count(C.USER_ID_START)

        def person(role: int, branch: int | None, label: str, active: bool = True) -> Person:
            while True:
                first, last = rng.choice(C.FIRST_NAMES), rng.choice(C.LAST_NAMES)
                email = (f"{first}.{last}".lower().replace(" ", "").replace("á", "a").replace("é", "e").replace("í", "i")
                         .replace("ó", "o").replace("ú", "u").replace("ñ", "n")) + f"@{C.DEMO_EMAIL_DOMAIN}"
                if email not in used:
                    used.add(email)
                    break
            p = Person(next(uid), f"{first} {last}", email, role, branch, active)
            self.users.append(p)
            return p

        self.admin = person(1, 1, "admin")
        self.admin.name, self.admin.email = "Administrador Demo", f"admin@{C.DEMO_EMAIL_DOMAIN}"
        used.add(self.admin.email)
        self.staff: dict[int, dict[str, list[Person]]] = {}
        for branch, (managers, operators, sellers) in C.BRANCH_STAFF.items():
            self.staff[branch] = {
                "manager": [person(2, branch, "gerente") for _ in range(managers)],
                "operator": [person(3, branch, "operador") for _ in range(operators)],
                "seller": [person(4, branch, "vendedor") for _ in range(sellers)],
            }
        # Personas que ya no trabajan en la empresa: no hacen nada, pero siguen en la lista de usuarios.
        person(4, 2, "ex", active=False)
        person(3, 3, "ex", active=False)
        self.by_id = {p.id: p for p in self.users}

    def _build_catalog(self) -> None:
        rng = self.rng
        by_cat: dict[str, list[Prod]] = defaultdict(list)
        for index, (cat, name, unit, cost, margin, active) in enumerate(C.PRODUCTS):
            name_cat, _group, qty_range, multiple, cat_pop = C.CATEGORIES[cat]
            prod = Prod(C.PRODUCT_ID_START + index, cat, name, unit, float(cost), margin, active, qty_range=qty_range, multiple=multiple)
            prod.cpp = prod.cost0
            step = 50 if cost * (1 + margin) < 20000 else 100
            prod.price = float(max(step, round(cost * (1 + margin) / step) * step))
            by_cat[cat].append(prod)
            self.products[prod.id] = prod
        # Popularidad: dentro de cada categoría unos pocos productos concentran las ventas (ley de Zipf).
        for cat, prods in by_cat.items():
            order = prods[:]
            rng.shuffle(order)
            for rank, prod in enumerate(order, start=1):
                prod.weight = C.CATEGORIES[cat][4] / (rank ** 0.85)
        # Proveedores por producto: el principal del grupo de la categoría y, a veces, uno o dos de respaldo.
        group_suppliers: dict[str, list[tuple]] = defaultdict(list)
        generic = [s for s in C.SUPPLIERS if s[4] == "*"]
        for supplier in C.SUPPLIERS:
            group_suppliers[supplier[4]].append(supplier)
        for prod in self.products.values():
            group = C.CATEGORIES[prod.cat][1]
            primary = rng.choice(group_suppliers[group])
            chosen = [(primary[0], prod.cost0 * rng.uniform(0.96, 1.03), True)]
            for extra in rng.sample(generic + [s for s in group_suppliers[group] if s[0] != primary[0]], k=rng.choice([0, 1, 1, 2])):
                if extra[0] != primary[0]:
                    chosen.append((extra[0], prod.cost0 * rng.uniform(1.03, 1.1), False))
            self.suppliers_of[prod.id] = chosen
        self.supplier_days = {s[0]: s[3] for s in C.SUPPLIERS}

    def _build_customers(self) -> None:
        rng = self.rng
        for _ in range(260):
            first, last = rng.choice(C.FIRST_NAMES), rng.choice(C.LAST_NAMES)
            self.customers.append((f"{first} {last}", str(rng.randint(1_000_000, 1_099_999_999))))
        for _ in range(70):
            name = f"{rng.choice(C.COMPANY_WORDS)} {rng.choice(C.COMPANY_NAMES)} {rng.choice(['S.A.S.', 'Ltda.', 'S.A.'])}"
            nit = f"{rng.randint(800_000_000, 901_999_999)}-{rng.randint(0, 9)}"
            self.customers.append((name, nit))

    def _build_items(self) -> None:
        rng = self.rng
        active = [p for p in self.products.values() if p.active]
        for branch, size in C.BRANCH_SIZE.items():
            carried = [p for p in active if branch == 1 or rng.random() < 0.88]
            total_weight = sum(p.weight for p in carried)
            lines_per_day = 14 * size * 2.7 * self.scale
            for prod in carried:
                lo, hi = prod.qty_range
                avg_qty = (lo + hi) / 2 if hi <= 30 else (lo + hi) / 3
                demand = max(0.02, lines_per_day * prod.weight / total_weight * avg_qty)
                item = Item(demand=demand)
                item.minimum = max(1.0, math.ceil(demand * 6 / prod.multiple) * prod.multiple if prod.multiple <= 10 else math.ceil(demand * 6))
                self.items[(branch, prod.id)] = item

    # ------------------------------------------------------------------ inventario
    def move(self, ts: datetime, kind: str, reason: str, qty: float, prod: int, branch: int, user: int, ref: int | None,
             ref_type: str | None, note: str | None = None, sub: str | None = None) -> None:
        item = self.items[(branch, prod)]
        signed = qty if kind == "INGRESO" else -qty
        item.stock = round(item.stock + signed, 4)
        self.total_stock[prod] = round(self.total_stock[prod] + signed, 4)
        item.last_update = ts
        assert item.stock >= -1e-6, f"stock negativo en {branch}/{prod}"
        if kind == "INGRESO" and item.alert is not None and item.stock > item.minimum:
            res = {"COMPRA": "PURCHASE", "TRASLADO": "TRANSFER"}.get(reason, "DISMISSED")
            self.resolve_alert(item.alert, ts, res, ref if res != "DISMISSED" else None, "Stock repuesto" if res == "DISMISSED" else None)
            item.alert = None
        self.rows["movimiento_inventario"].append((ts, next(self.seq), kind, reason, qty, prod, branch, user, ref, ref_type, round(item.stock, 2), note, sub))

    def add_with_cost(self, ts: datetime, qty: float, prod: int, branch: int, user: int, order: int, unit_cost: float) -> None:
        """Ingreso por compra: recalcula el costo promedio como el backend (sobre el stock de todas las sucursales)."""
        product = self.products[prod]
        stock = self.total_stock[prod]
        if stock <= 0 or product.cpp == 0:
            product.cpp = money(unit_cost)
        else:
            product.cpp = money((product.cpp * stock + unit_cost * qty) / (stock + qty))
        self.move(ts, "INGRESO", "COMPRA", qty, prod, branch, user, order, "ORDEN_COMPRA")

    # ------------------------------------------------------------------ alertas
    def alert(self, ts: datetime, branch: int, prod: int, message: str, kind: str, ref: int | None = None) -> dict:
        row = {"id": self.next_id("alertas_stock"), "branch": branch, "prod": prod, "msg": message, "ts": ts, "resolved": False,
               "type": kind, "res_type": None, "ref": ref, "why": None, "res_ts": None}
        self.rows["alertas_stock"].append(row)
        return row

    def resolve_alert(self, row: dict, ts: datetime, res_type: str | None, ref: int | None = None, why: str | None = None) -> None:
        row.update(resolved=True, res_ts=ts, res_type=res_type, ref=ref if ref is not None else row["ref"], why=why)

    def check_low_stock(self, ts: datetime, branch: int, prod: int) -> None:
        item = self.items[(branch, prod)]
        if item.alert is not None or item.stock > item.minimum:
            return
        product = self.products[prod]
        branch_name = self.branch_name(branch)
        qty = int(item.stock) if float(item.stock).is_integer() else item.stock
        if item.stock <= 0 or item.stock <= item.minimum * 0.5:
            msg = f"⚠ Stock crítico en {branch_name}: {product.name} tiene solo {qty} {product.unit} (Mínimo: {int(item.minimum)})"
        else:
            msg = f"Stock bajo: {product.name} ({branch_name})"
        item.alert = self.alert(ts, branch, prod, msg, "LOW_STOCK")

    def branch_name(self, branch: int) -> str:
        names = {**C.EXISTING_BRANCHES, **{b[0]: b[1] for b in C.NEW_BRANCHES}}
        return names[branch]

    def settle_alert(self, ts: datetime, branch: int, prod: int, res_type: str, ref: int, why: str) -> None:
        item = self.items[(branch, prod)]
        if item.alert is not None:
            self.resolve_alert(item.alert, ts, res_type, ref, why)
            item.alert = None

    # ------------------------------------------------------------------ ventas
    def day_factor(self, day: date) -> float:
        weekday = day.weekday()
        base = [1.0, 0.95, 1.0, 1.05, 1.2, 1.45, 0.55][weekday]
        if day.day in (14, 15, 16, 29, 30, 31, 1):
            base *= 1.18  # quincena
        trend = 1 + 0.0009 * (day - self.start).days
        return base * trend

    def sale_time(self, day: date) -> datetime:
        hour = self.rng.choices(range(7, 19), weights=[3, 6, 8, 9, 8, 6, 5, 7, 8, 7, 5, 3])[0]
        return datetime(day.year, day.month, day.day, hour, self.rng.randint(0, 59), self.rng.randint(0, 59))

    def pick_seller(self, branch: int) -> Person:
        staff = self.staff[branch]
        pool = staff["seller"] if self.rng.random() < 0.86 else staff["manager"] + staff["operator"]
        return self.rng.choice(pool)

    def do_sale(self, ts: datetime, branch: int) -> None:
        rng = self.rng
        seller = self.pick_seller(branch)
        candidates = [p for (b, p), it in self.items.items() if b == branch and it.stock > 0]
        if not candidates:
            return
        weights = [self.products[p].weight for p in candidates]
        n_lines = rng.choices([1, 2, 3, 4, 5, 6], weights=[30, 28, 18, 12, 8, 4])[0]
        chosen: list[int] = []
        for p in rng.choices(candidates, weights=weights, k=n_lines * 2):
            if p not in chosen:
                chosen.append(p)
            if len(chosen) == n_lines:
                break
        company = rng.random() < 0.12
        named = company or rng.random() < 0.34
        name = doc = None
        if named:
            pool = self.customers[260:] if company else self.customers[:260]
            name, doc = pool[min(int(rng.expovariate(1 / 25)), len(pool) - 1)]
        wholesale = company and rng.random() < 0.7
        global_pct = rng.choices([0, 3, 5, 10], weights=[88, 3, 5, 4])[0] if not wholesale else rng.choice([5, 8, 10])
        lines = []
        for p in chosen:
            item = self.items[(branch, p)]
            product = self.products[p]
            lo, hi = product.qty_range
            # La mayoría de las líneas son cantidades pequeñas; unas pocas son pedidos grandes (obra, constructor).
            qty = min(hi, lo + int(rng.expovariate(1 / max(0.6, (hi - lo) / 5))))
            if wholesale:
                qty = int(qty * rng.uniform(1.5, 2.5))
            qty = int(min(max(qty, 1), item.stock))
            if qty < 1:
                continue
            disc = rng.choices([0, 5, 10], weights=[93, 4, 3])[0] if not wholesale else 0
            lines.append((p, qty, product.price, disc))
        if not lines:
            return
        sid = self.next_id("ventas")
        detail = []
        base = lines_total = 0.0
        for p, qty, price, disc in lines:
            line_total = money(qty * price * (1 - disc / 100))
            base += qty * price
            lines_total += line_total
            detail.append((self.next_id("detalles_venta"), sid, p, qty, price, disc, line_total, self.products[p].name))
        discount_global = money(lines_total * global_pct / 100)
        final = money(lines_total - discount_global)
        method = rng.choices(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"], weights=[44, 36, 17, 3])[0]
        reference = {"TARJETA": f"V-{rng.randint(100000, 999999)}", "TRANSFERENCIA": f"TR-{rng.randint(1000000, 9999999)}"}.get(method)
        sale = {"id": sid, "branch": branch, "user": seller.id, "ts": ts, "subtotal": money(base), "discount": money(base - final), "total": final,
                "status": "COMPLETED", "reason": None, "customer": name, "doc": doc, "global": global_pct, "lines": detail,
                "pay_method": method, "pay_ref": reference}
        self.sales[sid] = sale
        self.rows["ventas"].append(sale)
        self.rows["detalles_venta"].extend(detail)
        for _id, _sid, p, qty, price, disc, _lt, _nm in detail:
            self.move(ts, "RETIRO", "VENTA", qty, p, branch, seller.id, sid, "VENTA")
            self.check_low_stock(ts, branch, p)
        if rng.random() < 0.018:
            self.schedule(ts + timedelta(minutes=rng.randint(8, 180)), "cancel_sale", sale=sid)
        elif rng.random() < 0.016:
            self.schedule(ts + timedelta(hours=rng.randint(4, 24 * 18)), "return_request", sale=sid)

    def do_cancel(self, ts: datetime, sale_id: int) -> None:
        sale = self.sales[sale_id]
        if sale["status"] != "COMPLETED":
            return
        reason = self.rng.choice(REASONS_CANCEL)
        manager = self.rng.choice(self.staff[sale["branch"]]["manager"])
        sale.update(status="CANCELED", reason=reason)
        for _id, _sid, p, qty, *_ in sale["lines"]:
            self.move(ts, "INGRESO", "DEVOLUCION", qty, p, sale["branch"], manager.id, sale_id, "ANULACION_VENTA", f"Anulación #{sale_id}: {reason}")
        first = sale["lines"][0][2]
        row = self.alert(ts, sale["branch"], first, f"Venta #{sale_id} anulada por {manager.name}: {reason}", "VOID_SALE", sale_id)
        if ts < self.now - timedelta(days=3) or self.rng.random() < 0.3:
            self.resolve_alert(row, ts + timedelta(hours=self.rng.randint(2, 48)), None)

    def do_return_request(self, ts: datetime, sale_id: int) -> None:
        sale = self.sales[sale_id]
        if sale["status"] != "COMPLETED":
            return
        rng = self.rng
        lines = rng.sample(sale["lines"], k=min(len(sale["lines"]), rng.choice([1, 1, 2])))
        rid = self.next_id("solicitudes_devolucion")
        requester = rng.choice(self.staff[sale["branch"]]["seller"])
        detail = []
        for _id, _sid, p, qty, price, disc, line_total, _nm in lines:
            units = rng.randint(1, max(1, min(qty, 5)))
            paid = money(line_total / qty * (1 - sale["global"] / 100))
            detail.append((self.next_id("detalles_devolucion_solicitud"), rid, p, units, rng.choice(REASONS_RETURN), paid))
        req = {"id": rid, "sale": sale_id, "branch": sale["branch"], "requester": requester.id, "approver": None, "status": "PENDIENTE", "ts": ts,
               "done": None, "reason": rng.choice(REASONS_RETURN), "comment": None, "lines": detail, "alert": None}
        self.returns[rid] = req
        self.rows["solicitudes_devolucion"].append(req)
        self.rows["detalles_devolucion_solicitud"].extend(detail)
        req["alert"] = self.alert(ts, sale["branch"], detail[0][2], f"Devolución solicitada de la venta #{sale_id}: {req['reason']}", "RETURN_REQUEST", rid)
        self.schedule(ts + timedelta(hours=rng.randint(2, 120)), "decide_return", req=rid)

    def do_decide_return(self, ts: datetime, rid: int) -> None:
        rng = self.rng
        req = self.returns[rid]
        sale = self.sales[req["sale"]]
        manager = rng.choice(self.staff[req["branch"]]["manager"])
        approved = rng.random() < 0.74 and sale["status"] == "COMPLETED"
        req.update(approver=manager.id, done=ts, status="APROBADA" if approved else "RECHAZADA",
                   comment="Todo en orden, se devuelve al inventario" if approved else rng.choice(["Fuera del plazo de devolución", "El producto no tiene defecto", "Sin factura ni empaque original"]))
        if approved:
            sale["status"] = "RETURNED"
            for _id, _rid, p, units, why, _paid in req["lines"]:
                self.move(ts, "INGRESO", "DEVOLUCION", units, p, req["branch"], manager.id, sale["id"], "DEVOLUCION", f"Devolución Aprobada Solicitud #{rid}: {why}")
        self.resolve_alert(req["alert"], ts, None)

    # ------------------------------------------------------------------ reposición
    def ordering_user(self, branch: int) -> tuple[Person, bool]:
        """Quién crea la orden y si necesita aprobación (la crea un operador)."""
        if self.rng.random() < 0.62:
            return self.rng.choice(self.staff[branch]["operator"]), True
        return self.rng.choice(self.staff[branch]["manager"]), False

    def do_reorder(self, ts: datetime, branch: int) -> None:
        rng = self.rng
        needs: dict[int, list[tuple[int, float]]] = defaultdict(list)  # proveedor -> [(producto, cantidad)]
        moves: dict[tuple[int, int], list[tuple[int, float]]] = defaultdict(list)  # (origen, destino) -> [(producto, cantidad)]
        for (b, p), item in self.items.items():
            if b != branch:
                continue
            product = self.products[p]
            if item.stock + item.on_order > item.minimum * 1.6 or (b, p) in self.open_orders:
                continue
            target = item.demand * 30 + item.minimum - item.stock - item.on_order
            qty = max(product.multiple, math.ceil(target / product.multiple) * product.multiple)
            donor = self.find_donor(branch, p, qty)
            if donor is not None and rng.random() < 0.45:
                moves[(donor[0], branch)].append((p, donor[1]))
                continue
            suppliers = self.suppliers_of[p]
            supplier = suppliers[0] if rng.random() < 0.8 else rng.choice(suppliers)
            needs[supplier[0]].append((p, float(qty)))
        for supplier, lines in needs.items():
            self.create_order(ts, branch, supplier, lines)
        for (origin, dest), lines in moves.items():
            self.create_transfer(ts, origin, dest, lines)

    def find_donor(self, branch: int, prod: int, needed: float) -> tuple[int, int] | None:
        best = None
        for other in self.branches:
            if other == branch or (other, prod) not in self.items:
                continue
            item = self.items[(other, prod)]
            spare = item.stock - item.reserved - item.minimum * 2.2
            ask = min(needed, spare * 0.5)
            if ask >= max(2, self.items[(branch, prod)].minimum * 0.8) and (best is None or ask > best[1]):
                best = (other, int(ask))
        return best

    def create_order(self, ts: datetime, branch: int, supplier: int, lines: list[tuple[int, float]]) -> None:
        rng = self.rng
        creator, needs_approval = self.ordering_user(branch)
        oid = self.next_id("ordenes_compra")
        lead = self.supplier_days[supplier]
        plazo = rng.choice([30, 30, 45, 60, 15])
        inflation = 1 + 0.006 * ((ts.date() - self.start).days / 30)
        detail = []
        total = 0.0
        for p, qty in lines:
            base = next((price for s, price, _pref in self.suppliers_of[p] if s == supplier), self.products[p].cost0 * 1.06)
            price = money(base * inflation * rng.uniform(0.99, 1.01))
            disc = rng.choice([0, 0, 0, 3, 5]) if qty * price > 1_500_000 else 0
            sub = money(qty * price * (1 - disc / 100))
            total += sub
            detail.append({"id": self.next_id("detalles_orden_compra"), "order": oid, "prod": p, "qty": qty, "price": price, "sub": sub, "disc": disc, "got": 0.0})
            self.items[(branch, p)].on_order += qty
            self.open_orders[(branch, p)] = oid
        t_approved = ts + timedelta(hours=rng.randint(1, 20)) if needs_approval else ts
        t_shipped = t_approved + timedelta(hours=lead * 24 * rng.uniform(0.15, 0.5))
        t_arrive = ts + timedelta(days=lead + rng.choice([0, 0, 1, 1, 2, 3]), hours=rng.randint(0, 6))
        receiver = rng.choice(self.staff[branch]["operator"])
        order = {"id": oid, "supplier": supplier, "branch": branch, "user": creator.id, "receiver": None, "ts": ts, "eta": t_arrive,
                 "arrived": None, "status": "AWAITING_APPROVAL" if needs_approval else "PENDING", "pay": "POR_PAGAR", "total": money(total),
                 "plazo": plazo, "due": None, "lead": lead, "note": None, "resolver": None, "resolved_ts": None, "lines": detail, "paid_ts": None}
        self.orders[oid] = order
        self.rows["ordenes_compra"].append(order)
        for line in detail:
            self.rows["detalles_orden_compra"].append(line)
            self.settle_alert(ts, branch, line["prod"], "PURCHASE", oid, "Abastecimiento vía orden de compra")
        if rng.random() < 0.035:
            self.schedule(t_approved + timedelta(hours=rng.randint(2, 30)), "cancel_order", order=oid)
            self.schedule(t_approved, "approve_order", order=oid, manager=rng.choice(self.staff[branch]["manager"]).id)
            return
        if needs_approval:
            self.schedule(t_approved, "approve_order", order=oid, manager=rng.choice(self.staff[branch]["manager"]).id)
        self.schedule(t_shipped, "ship_order", order=oid)
        partial = rng.random() < 0.1
        self.schedule(t_arrive, "receive_order", order=oid, receiver=receiver.id, fraction=rng.uniform(0.55, 0.9) if partial else 1.0)

    def do_approve_order(self, ts: datetime, oid: int, manager: int) -> None:
        order = self.orders[oid]
        if order["status"] == "AWAITING_APPROVAL":
            order["status"] = "PENDING"

    def do_cancel_order(self, ts: datetime, oid: int) -> None:
        order = self.orders[oid]
        if order["status"] in ("AWAITING_APPROVAL", "PENDING"):
            order.update(status="CANCELLED", note="Cancelada: el proveedor no tenía existencias", resolver=self.rng.choice(self.staff[order["branch"]]["manager"]).id, resolved_ts=ts)
            for line in order["lines"]:
                self.items[(order["branch"], line["prod"])].on_order -= line["qty"]
                self.open_orders.pop((order["branch"], line["prod"]), None)

    def do_ship_order(self, ts: datetime, oid: int) -> None:
        order = self.orders[oid]
        if order["status"] in ("PENDING", "AWAITING_APPROVAL"):
            order["status"] = "IN_TRANSIT"

    def do_receive_order(self, ts: datetime, oid: int, receiver: int, fraction: float) -> None:
        order = self.orders[oid]
        if order["status"] == "CANCELLED":
            return
        order["receiver"] = receiver
        complete = True
        for line in order["lines"]:
            pending = line["qty"] - line["got"]
            if pending <= 0:
                continue
            qty = pending if fraction >= 1 else max(1.0, math.floor(pending * fraction))
            line["got"] += qty
            self.add_with_cost(ts, qty, line["prod"], order["branch"], receiver, oid, line["price"])
            self.items[(order["branch"], line["prod"])].on_order -= qty
            if line["got"] < line["qty"]:
                complete = False
            else:
                self.open_orders.pop((order["branch"], line["prod"]), None)
        if complete:
            self.finish_order(ts, order)
        else:
            order["status"] = "RECEIVED_PARTIAL"
            if self.rng.random() < 0.8:
                self.schedule(ts + timedelta(days=self.rng.randint(2, 6), hours=self.rng.randint(0, 5)), "receive_order", order=oid, receiver=receiver, fraction=1.0)
            else:
                self.schedule(ts + timedelta(days=7), "close_short", order=oid)

    def do_close_short(self, ts: datetime, oid: int) -> None:
        order = self.orders[oid]
        if order["status"] != "RECEIVED_PARTIAL":
            return
        for line in order["lines"]:
            self.items[(order["branch"], line["prod"])].on_order -= line["qty"] - line["got"]
            self.open_orders.pop((order["branch"], line["prod"]), None)
        order.update(note="Cerrada con faltante: el proveedor no completó el pedido", resolver=self.rng.choice(self.staff[order["branch"]]["manager"]).id, resolved_ts=ts)
        self.finish_order(ts, order)

    def finish_order(self, ts: datetime, order: dict) -> None:
        order["status"] = "RECEIVED_TOTAL"
        order["arrived"] = ts
        order["due"] = order["ts"] + timedelta(days=order["plazo"])
        if order["note"]:
            order["total"] = money(sum(l["got"] * l["price"] * (1 - l["disc"] / 100) for l in order["lines"]))
        pay_at = ts + timedelta(days=self.rng.randint(5, order["plazo"] + 12), hours=self.rng.randint(0, 8))
        if self.rng.random() < 0.12:
            self.schedule(ts + (pay_at - ts) / 2, "pay_order", order=order["id"], partial=True)
        self.schedule(pay_at, "pay_order", order=order["id"], partial=False)

    def do_pay_order(self, ts: datetime, oid: int, partial: bool) -> None:
        order = self.orders[oid]
        if order["pay"] != "PAGADO":
            rng = self.rng
            paid = sum(p["amount"] for p in self.rows["pagos_orden_compra"] if p["order"] == oid)
            amount = money(order["total"] * rng.uniform(0.3, 0.7)) if partial else money(order["total"] - paid)
            if amount > 0:
                method = rng.choices(["TRANSFERENCIA", "CHEQUE", "EFECTIVO"], weights=[70, 20, 10])[0]
                self.rows["pagos_orden_compra"].append({
                    "id": self.next_id("pagos_orden_compra"), "order": oid, "amount": amount, "ts": ts,
                    "user": rng.choice(self.staff[order["branch"]]["manager"]).id, "method": method,
                    "ref": {"TRANSFERENCIA": f"TR-{rng.randint(1000000, 9999999)}", "CHEQUE": f"CH-{rng.randint(10000, 99999)}"}.get(method),
                    "note": "Abono" if partial else None,
                })
            order["pay"] = "PAGO_PARCIAL" if partial else "PAGADO"
            order["paid_ts"] = ts

    # ------------------------------------------------------------------ traslados
    def do_pay_freight(self, ts: datetime, tid: int, partial: bool) -> None:
        """Pago (o abono) del flete al transportista; el gerente de la sucursal de origen lo registra."""
        rng = self.rng
        t = self.transfers[tid]
        paid = sum(p["amount"] for p in self.rows["pagos_traslado"] if p["transfer"] == tid)
        pending = money(t["cost"] - paid)
        if t["status"] not in ("IN_TRANSIT", "DELIVERED", "WITH_ISSUE", "UNDER_CLAIM", "CANCELLED") or pending <= 0:
            return
        amount = money(pending * rng.uniform(0.3, 0.7)) if partial else pending
        if amount <= 0:
            return
        method = rng.choices(["TRANSFERENCIA", "EFECTIVO", "CHEQUE"], weights=[60, 30, 10])[0]
        self.rows["pagos_traslado"].append({
            "id": self.next_id("pagos_traslado"), "transfer": tid, "amount": amount, "ts": ts,
            "user": rng.choice(self.staff[t["origin"]]["manager"]).id, "method": method,
            "ref": {"TRANSFERENCIA": f"TR-{rng.randint(1000000, 9999999)}", "CHEQUE": f"CH-{rng.randint(10000, 99999)}"}.get(method),
            "note": "Abono" if partial else None,
        })

    def create_transfer(self, ts: datetime, origin: int, dest: int, lines: list[tuple[int, float]]) -> None:
        rng = self.rng
        tid = self.next_id("transferencias")
        requester = rng.choice(self.staff[dest]["manager"] + self.staff[dest]["operator"])
        authorizer = rng.choice(self.staff[origin]["manager"])
        dispatcher = rng.choice(self.staff[origin]["operator"])
        receiver = rng.choice(self.staff[dest]["operator"])
        priority = rng.choices(["HIGH", "NORMAL", "LOW"], weights=[18, 66, 16])[0]
        detail = []
        for p, qty in lines:
            item = self.items[(origin, p)]
            item.reserved += qty
            detail.append({"id": self.next_id("detalles_transferencia"), "transfer": tid, "prod": p, "req": int(qty), "sent": 0, "got": 0, "missing": 0})
            self.settle_alert(ts, dest, p, "TRANSFER", tid, "Abastecimiento vía transferencia interna")
            self.open_orders[(dest, p)] = -tid
            self.items[(dest, p)].on_order += qty
        route_hours = 3 + (abs(origin - dest) % 5) * 2
        t_approved = ts + timedelta(hours=rng.randint(1, 10))
        t_prepared = t_approved + timedelta(hours=rng.randint(1, 8))
        t_dispatch = t_prepared + timedelta(hours=rng.randint(1, 18))
        t_receive = t_dispatch + timedelta(hours=route_hours + rng.randint(2, 30))
        transfer = {"id": tid, "status": "PENDING", "ts": ts, "eta": t_dispatch + timedelta(hours=route_hours + 6), "arrived": None, "origin": origin, "dest": dest,
                    "carrier": None, "notes": None, "parent": None, "reason": None, "resolver": None, "resolved_ts": None, "priority": priority,
                    "cost": None, "guide": None, "dispatch_ts": None, "requester": requester, "authorizer": None, "dispatcher": None, "receiver": None,
                    "lines": detail, "alert": None}
        self.transfers[tid] = transfer
        self.rows["transferencias"].append(transfer)
        self.rows["detalles_transferencia"].extend(detail)
        transfer["alert"] = self.alert(ts, dest, detail[0]["prod"], f"Traslado #{tid} solicitado a {self.branch_name(origin)}", "TRANSFER_REQUEST", tid)
        if rng.random() < 0.05:
            self.schedule(t_approved, "reject_transfer", transfer=tid, by=authorizer)
            return
        self.schedule(t_approved, "approve_transfer", transfer=tid)
        self.schedule(t_prepared, "prepare_transfer", transfer=tid, by=authorizer)
        self.schedule(t_dispatch, "dispatch_transfer", transfer=tid, by=dispatcher)
        missing = rng.random() < 0.11
        self.schedule(t_receive, "receive_transfer", transfer=tid, by=receiver, missing=missing)

    def do_transfer_step(self, ts: datetime, kind: str, tid: int, by: Person | None = None, missing: bool = False) -> None:
        rng = self.rng
        t = self.transfers[tid]
        if kind == "approve_transfer" and t["status"] == "PENDING":
            t["status"] = "APPROVED_DEST"
        elif kind == "prepare_transfer" and t["status"] == "APPROVED_DEST":
            t["status"], t["authorizer"] = "PREPARING", by
        elif kind == "reject_transfer" and t["status"] == "PENDING":
            t.update(status="REJECTED", reason="Sin existencias suficientes en la sucursal de origen", resolver=by, resolved_ts=ts)
            for line in t["lines"]:
                self.items[(t["origin"], line["prod"])].reserved -= line["req"]
                self.items[(t["dest"], line["prod"])].on_order -= line["req"]
                self.open_orders.pop((t["dest"], line["prod"]), None)
            self.resolve_alert(t["alert"], ts, None)
        elif kind == "dispatch_transfer" and t["status"] == "PREPARING":
            t.update(status="IN_TRANSIT", dispatch_ts=ts, dispatcher=by, carrier=rng.choice(C_CARRIERS), cost=float(rng.choice([0, 8000, 12000, 15000, 22000, 35000])),
                     guide=f"{rng.randint(10**9, 10**10 - 1)}")
            for line in t["lines"]:
                item = self.items[(t["origin"], line["prod"])]
                sent = int(min(line["req"], item.stock))
                line["sent"] = sent
                item.reserved -= line["req"]
                if sent > 0:
                    self.move(ts, "RETIRO", "TRASLADO", sent, line["prod"], t["origin"], by.id, tid, "TRANSFERENCIA_OUT")
                    self.check_low_stock(ts, t["origin"], line["prod"])
            self.resolve_alert(t["alert"], ts, None)
            # El flete suele pagarse días después; los más recientes quedan por pagar.
            if t["cost"] > 0 and rng.random() < 0.7:
                self.schedule(ts + timedelta(days=rng.randint(2, 20), hours=rng.randint(0, 8)), "pay_freight", transfer=tid, partial=rng.random() < 0.15)
        elif kind == "receive_transfer" and t["status"] == "IN_TRANSIT":
            t.update(arrived=ts, receiver=by)
            issue = False
            for line in t["lines"]:
                got = line["sent"]
                if missing and line is t["lines"][0] and got > 1:
                    got = max(0, got - rng.randint(1, max(1, got // 3)))
                    issue = True
                line["got"], line["missing"] = got, line["sent"] - got
                self.items[(t["dest"], line["prod"])].on_order -= line["req"]
                self.open_orders.pop((t["dest"], line["prod"]), None)
                if got > 0:
                    self.move(ts, "INGRESO", "TRASLADO", got, line["prod"], t["dest"], by.id, tid, "TRANSFERENCIA_IN", t["notes"])
            if issue:
                t["status"], t["notes"] = "WITH_ISSUE", "Llegaron menos unidades de las enviadas"
                t["issue_alert"] = self.alert(ts, t["dest"], t["lines"][0]["prod"], f"Novedad en el traslado #{tid}: llegaron menos unidades de las enviadas", "ISSUE_REPORTED", tid)
                self.schedule(ts + timedelta(days=rng.randint(1, 6)), "resolve_issue", transfer=tid)
            else:
                t["status"] = "DELIVERED"

    def do_resolve_issue(self, ts: datetime, tid: int) -> None:
        rng = self.rng
        t = self.transfers[tid]
        if t["status"] != "WITH_ISSUE":
            return
        manager = rng.choice(self.staff[t["dest"]]["manager"])
        how = rng.choice(["shrinkage", "shrinkage", "claim"])
        if how == "claim":
            t["status"] = "UNDER_CLAIM"
            t.update(reason="Reclamo abierto ante la transportadora", resolver=manager, resolved_ts=ts)
            self.resolve_alert(t["issue_alert"], ts, None)
        else:
            t["status"] = "DELIVERED"
            t.update(reason="Faltante asumido como merma de transporte", resolver=manager, resolved_ts=ts)
            self.resolve_alert(t["issue_alert"], ts, None)

    # ------------------------------------------------------------------ ajustes
    def do_adjustment(self, ts: datetime, branch: int) -> None:
        rng = self.rng
        keys = [k for k in self.items if k[0] == branch and self.items[k].stock >= 3]
        if not keys:
            return
        _b, p = rng.choice(keys)
        item = self.items[(branch, p)]
        user = rng.choice(self.staff[branch]["manager"] + self.staff[branch]["operator"])
        roll = rng.random()
        if roll < 0.45:
            sub, note = rng.choice(SHRINKAGE)
            qty = max(1, int(item.stock * rng.uniform(0.01, 0.06)))
            self.move(ts, "RETIRO", "MERMA", qty, p, branch, user.id, None, None, note, sub)
        elif roll < 0.75:
            qty = max(1, int(item.stock * rng.uniform(0.005, 0.04)))
            self.move(ts, "RETIRO", "AJUSTE_NEGATIVO", qty, p, branch, user.id, None, None, rng.choice(COUNT_NOTES))
        else:
            qty = max(1, int(item.demand * rng.uniform(0.5, 2)))
            self.move(ts, "INGRESO", "AJUSTE_POSITIVO", qty, p, branch, user.id, None, None, rng.choice(COUNT_NOTES))
        self.check_low_stock(ts, branch, p)

    # ------------------------------------------------------------------ bucle principal
    def run(self) -> None:
        rng = self.rng
        # Inventario inicial el día anterior al comienzo.
        opening = datetime(self.start.year, self.start.month, self.start.day, 7, 30) - timedelta(days=1)
        for (branch, p), item in sorted(self.items.items()):
            product = self.products[p]
            qty = max(item.minimum * 2, math.ceil(item.demand * rng.uniform(14, 30) / product.multiple) * product.multiple)
            manager = self.staff[branch]["manager"][0]
            self.move(opening, "INGRESO", "AJUSTE_POSITIVO", qty, p, branch, manager.id, None, None, "Inventario inicial: carga de existencias")
        for offset in range((self.today - self.start).days + 1):
            day = self.start + timedelta(days=offset)
            if day.day == 1 and day > self.start:
                for product in self.products.values():
                    step = 50 if product.price < 20000 else 100
                    product.price = max(product.price, round(product.price * 1.006 / step) * step)
            for branch, size in C.BRANCH_SIZE.items():
                lam = 14 * size * self.scale * self.day_factor(day)
                if day.weekday() == 6 and branch in (13,):
                    continue
                for _ in range(max(0, int(rng.gauss(lam, math.sqrt(max(lam, 1)))))):
                    self.schedule(self.sale_time(day), "sale", branch=branch)
                self.schedule(datetime(day.year, day.month, day.day, 6, 30 + branch), "reorder", branch=branch)
                if rng.random() < 0.12:
                    self.schedule(datetime(day.year, day.month, day.day, rng.randint(8, 16), rng.randint(0, 59)), "adjust", branch=branch)
            end = datetime(day.year, day.month, day.day) + timedelta(days=1)
            self.drain(end)
        self.drain(self.now + timedelta(days=60))  # nada: los eventos futuros no se ejecutan, solo se vacía lo vencido
        self.finish()

    def drain(self, until: datetime) -> None:
        while self.heap and self.heap[0][0] < until:
            ts, _seq, kind, payload = heapq.heappop(self.heap)
            if ts > self.now:
                heapq.heappush(self.heap, (ts, _seq, kind, payload))
                if until > self.now:
                    return
                continue
            self.dispatch(ts, kind, payload)

    def dispatch(self, ts: datetime, kind: str, p: dict) -> None:
        if kind == "sale":
            self.do_sale(ts, p["branch"])
        elif kind == "cancel_sale":
            self.do_cancel(ts, p["sale"])
        elif kind == "return_request":
            self.do_return_request(ts, p["sale"])
        elif kind == "decide_return":
            self.do_decide_return(ts, p["req"])
        elif kind == "reorder":
            # Los lunes y jueves se revisa el stock; el resto de los días solo lo urgente (agotados).
            if ts.weekday() in (0, 3) or any(i.stock <= i.minimum * 0.3 for (b, _), i in self.items.items() if b == p["branch"]):
                self.do_reorder(ts, p["branch"])
        elif kind == "adjust":
            self.do_adjustment(ts, p["branch"])
        elif kind == "approve_order":
            self.do_approve_order(ts, p["order"], p["manager"])
        elif kind == "cancel_order":
            self.do_cancel_order(ts, p["order"])
        elif kind == "ship_order":
            self.do_ship_order(ts, p["order"])
        elif kind == "receive_order":
            self.do_receive_order(ts, p["order"], p["receiver"], p["fraction"])
        elif kind == "close_short":
            self.do_close_short(ts, p["order"])
        elif kind == "pay_order":
            self.do_pay_order(ts, p["order"], p["partial"])
        elif kind == "pay_freight":
            self.do_pay_freight(ts, p["transfer"], p["partial"])
        elif kind in ("approve_transfer", "prepare_transfer", "reject_transfer", "dispatch_transfer", "receive_transfer"):
            self.do_transfer_step(ts, kind, p["transfer"], p.get("by"), p.get("missing", False))
        elif kind == "resolve_issue":
            self.do_resolve_issue(ts, p["transfer"])
        else:  # pragma: no cover
            raise ValueError(kind)

    def finish(self) -> None:
        """Estado final: de vez en cuando una alerta vieja se descarta (producto descontinuado, error de conteo…)."""
        rng = self.rng
        for row in self.rows["alertas_stock"]:
            if not row["resolved"] and row["type"] == "LOW_STOCK" and row["ts"] < self.now - timedelta(days=9) and rng.random() < 0.5:
                self.resolve_alert(row, row["ts"] + timedelta(days=rng.randint(1, 5)), "DISMISSED", None, rng.choice(DISMISS_REASONS))
                item = self.items.get((row["branch"], row["prod"]))
                if item is not None and item.alert is row:
                    item.alert = None


C_CARRIERS = ["Servientrega", "Coordinadora", "TCC", "Envía", "Transporte propio", "Interrapidísimo"]
