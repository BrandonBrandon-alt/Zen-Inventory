"""Pruebas de la simulación: lo generado tiene que ser coherente (corre sin base de datos: `python3 -m unittest`)."""

import unittest
from collections import Counter
from datetime import date

import catalog as C
from demo_data import psql_command
from emit import clean_sql, load_sql
from generate import Sim


def simulate(seed: int = 7) -> Sim:
    sim = Sim(date(2026, 10, 18), 45, 0.35, seed, {})
    sim.run()
    return sim


class DemoDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sim = simulate()

    def test_es_determinista(self):
        self.assertEqual(load_sql(simulate()), load_sql(simulate()))
        self.assertNotEqual(load_sql(simulate(1)), load_sql(simulate(2)))

    def test_hay_volumen_de_empresa(self):
        rows = self.sim.rows
        self.assertGreater(len(rows["ventas"]), 1000)
        self.assertGreater(len(rows["ordenes_compra"]), 100)
        self.assertGreater(len(rows["transferencias"]), 20)
        self.assertGreater(len(rows["movimiento_inventario"]), 3000)

    def test_el_stock_final_es_el_ultimo_saldo_y_nunca_es_negativo(self):
        last = {}
        for ts, seq, kind, reason, qty, prod, branch, user, ref, ref_type, balance, note, sub in sorted(self.sim.rows["movimiento_inventario"], key=lambda m: (m[0], m[1])):
            last[(branch, prod)] = balance
            self.assertGreaterEqual(balance, 0)
        for key, item in self.sim.items.items():
            self.assertAlmostEqual(item.stock, last[key], places=1, msg=str(key))

    def test_los_totales_de_cada_venta_cuadran_con_sus_lineas(self):
        for sale in self.sim.rows["ventas"]:
            lines = sum(line[6] for line in sale["lines"])
            self.assertAlmostEqual(lines * (1 - sale["global"] / 100), sale["total"], delta=0.02)
            self.assertAlmostEqual(sum(l[3] * l[4] for l in sale["lines"]) - sale["total"], sale["discount"], delta=0.02)

    def test_las_compras_cuadran_y_lo_recibido_no_pasa_de_lo_pedido(self):
        for order in self.sim.rows["ordenes_compra"]:
            for line in order["lines"]:
                self.assertLessEqual(line["got"], line["qty"])
            if not order["note"]:
                self.assertAlmostEqual(sum(l["sub"] for l in order["lines"]), order["total"], delta=0.02)
            if order["status"] == "RECEIVED_TOTAL" and not order["note"]:
                self.assertTrue(all(l["got"] == l["qty"] for l in order["lines"]))

    def test_cada_devolucion_aprobada_marca_su_venta_como_devuelta(self):
        approved = {r["sale"] for r in self.sim.rows["solicitudes_devolucion"] if r["status"] == "APROBADA"}
        returned = {s["id"] for s in self.sim.rows["ventas"] if s["status"] == "RETURNED"}
        self.assertEqual(approved, returned)

    def test_cada_venta_trae_su_forma_de_pago(self):
        sales = self.sim.rows["ventas"]
        self.assertEqual({s["pay_method"] for s in sales} - {"EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"}, set())
        self.assertGreater(len({s["pay_method"] for s in sales}), 2)
        for s in sales:
            self.assertEqual(s["pay_ref"] is not None, s["pay_method"] in ("TARJETA", "TRANSFERENCIA"))

    def test_los_pagos_de_compras_cuadran_con_el_estado_de_pago(self):
        paid: dict[int, float] = {}
        for p in self.sim.rows["pagos_orden_compra"]:
            self.assertGreater(p["amount"], 0)
            paid[p["order"]] = paid.get(p["order"], 0) + p["amount"]
        for o in self.sim.rows["ordenes_compra"]:
            got = round(paid.get(o["id"], 0), 2)
            if o["pay"] == "PAGADO":
                self.assertAlmostEqual(got, o["total"], places=2, msg=f"orden {o['id']}")
            elif o["pay"] == "PAGO_PARCIAL":
                self.assertTrue(0 < got < o["total"], f"orden {o['id']}")
            else:
                self.assertEqual(got, 0, f"orden {o['id']}")

    def test_los_traslados_descuentan_y_suman_lo_que_dicen(self):
        out = Counter()
        into = Counter()
        for m in self.sim.rows["movimiento_inventario"]:
            if m[3] == "TRASLADO":
                (out if m[2] == "RETIRO" else into)[m[8]] += m[4]
        for t in self.sim.rows["transferencias"]:
            sent = sum(l["sent"] for l in t["lines"])
            got = sum(l["got"] for l in t["lines"])
            self.assertEqual(out[t["id"]], sent)
            self.assertEqual(into[t["id"]], got)
            if t["status"] == "DELIVERED" and not t["reason"]:
                self.assertEqual(sent, got)

    def test_una_alerta_resuelta_tiene_fecha_y_las_abiertas_no(self):
        for alert in self.sim.rows["alertas_stock"]:
            self.assertEqual(alert["resolved"], alert["res_ts"] is not None)
            self.assertGreaterEqual(alert["res_ts"] or alert["ts"], alert["ts"])

    def test_nada_ocurre_en_el_futuro(self):
        for sale in self.sim.rows["ventas"]:
            self.assertLessEqual(sale["ts"], self.sim.now)
        for m in self.sim.rows["movimiento_inventario"]:
            self.assertLessEqual(m[0], self.sim.now)

    def test_los_ids_fijos_estan_dentro_de_lo_que_borra_clean(self):
        sql = clean_sql()
        self.assertIn(f"BETWEEN {C.FIRST_DEMO_PRODUCT} AND {C.LAST_DEMO_PRODUCT}", sql)
        self.assertEqual(max(p.id for p in self.sim.products.values()), C.LAST_DEMO_PRODUCT)
        self.assertTrue(all(u.email.endswith(f"@{C.DEMO_EMAIL_DOMAIN}") for u in self.sim.users))

    def test_los_ids_respetan_el_desplazamiento_de_la_base(self):
        shifted = Sim(date(2026, 10, 18), 20, 0.2, 7, {"ventas": 5000, "movimiento_inventario": 90000})
        shifted.run()
        self.assertEqual(min(s["id"] for s in shifted.rows["ventas"]), 5001)

    def test_psql_habla_con_docker_o_con_una_base_remota(self):
        docker = psql_command("zenvory-db")
        self.assertEqual(docker[:4], ["docker", "exec", "-i", "zenvory-db"])
        remoto = psql_command("zenvory-db", "host=ep-x.neon.tech dbname=neondb user=u sslmode=require")
        self.assertEqual(remoto[0], "psql")
        self.assertIn("ON_ERROR_STOP=1", remoto)
        self.assertEqual(remoto[-1], "host=ep-x.neon.tech dbname=neondb user=u sslmode=require")
        self.assertNotIn("docker", remoto)


if __name__ == "__main__":
    unittest.main()
