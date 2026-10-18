# Datos de demostración

Genera una empresa en funcionamiento para probar la aplicación con volumen real: una distribuidora de materiales de
construcción con **6 sucursales** (más una cerrada), **173 productos** de 9 categorías, 16 proveedores, 36 usuarios,
y **6 meses de historia** día a día: ~18.000 ventas (~45.000 líneas), ~2.200 órdenes de compra, ~600 traslados,
~290 devoluciones, ~50.000 movimientos de inventario y las alertas que genera el stock bajo.

```bash
python3 scripts/demo-data/demo_data.py load     # borra la demostración anterior (si hay) y carga una nueva (~10 s)
python3 scripts/demo-data/demo_data.py clean    # deja la base sin los datos de demostración
python3 scripts/demo-data/demo_data.py sql > demo.sql   # solo genera el SQL, sin tocar la base
python3 -m unittest -q -C scripts/demo-data     # pruebas de la simulación
```

Opciones: `--days 180` (historia), `--scale 1` (volumen de ventas), `--seed 42` (la misma semilla da siempre los
mismos datos), `--today AAAA-MM-DD`, `--container zenvory-db`. Solo usa Python 3 y `docker exec` sobre el contenedor
de PostgreSQL del compose.

## Entrar

`admin@demo.zeninventory.co` (ADMIN) y, con la misma contraseña, cualquier usuario `nombre.apellido@demo.zeninventory.co`
(gerentes, operadores y vendedores de cada sucursal; hay dos personas inactivas). Contraseña: **`Demo-2026*`**.
Los usuarios de siempre (`admin@zeninventory.co`…) y sus datos no se tocan.

## Qué hay de coherente

Todo se simula en orden cronológico, así que lo que queda en la base respeta las reglas de la aplicación:

- El stock de cada sucursal es la suma de sus movimientos y el último saldo del kardex coincide con las existencias.
- Las compras recibidas mueven el costo promedio con la fórmula del backend; hay recepciones parciales, órdenes por
  aprobar, en camino, canceladas y pagos pendientes, parciales y completos.
- Un traslado descuenta del origen al despacharse y suma al destino al recibirse; hay novedades por faltantes,
  reclamos, rechazados y otros todavía en curso (con stock comprometido).
- Una venta anulada o una devolución aprobada devuelven el stock; hay devoluciones pendientes, aprobadas y rechazadas.
- Las alertas nacen cuando el stock cae al mínimo y se resuelven al comprar o trasladar; quedan algunas abiertas.
- Ventas con descuentos, clientes con nombre y NIT, quincenas y fines de semana más movidos, crecimiento mensual,
  precios que suben con la inflación, mermas y ajustes de inventario.

## Cómo no se mezcla con lo tuyo

Los datos de demostración se reconocen por su correo (`@demo.zeninventory.co`), por los ids fijos de sus productos
(101–273), proveedores (101–116), unidades (101–105) y sucursales (11–14). `clean` borra solo eso y todo lo que
hicieron esos usuarios; lo que crees después con la aplicación (con otros usuarios o productos) se conserva. Los ids
de ventas, compras, traslados y movimientos continúan a partir del último que haya en la base.
