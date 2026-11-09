-- Consolida las relaciones del esquema: toda columna que apunta a otra tabla queda con su clave foránea y su índice.
-- referencia_id (movimiento_inventario, alertas_stock) sigue sin FK a propósito: apunta a tablas distintas según el caso.

-- ------------------------------------------------------------
-- Traslados → usuarios
-- ------------------------------------------------------------
-- La FK estaba en resuelto_por_id, que nadie usa; las columnas en uso no tenían ninguna. Un id que ya no existe se
-- limpia: el nombre de la persona se conserva en la columna *_nombre.
UPDATE transferencias t SET solicitante_id = NULL WHERE solicitante_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = t.solicitante_id);
UPDATE transferencias t SET autorizador_id = NULL WHERE autorizador_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = t.autorizador_id);
UPDATE transferencias t SET despachador_id = NULL WHERE despachador_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = t.despachador_id);
UPDATE transferencias t SET recibidor_id = NULL WHERE recibidor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = t.recibidor_id);
UPDATE transferencias t SET resolutor_id = NULL WHERE resolutor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = t.resolutor_id);

ALTER TABLE transferencias
    DROP COLUMN resuelto_por_id,
    ADD CONSTRAINT transferencias_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES usuario (id),
    ADD CONSTRAINT transferencias_autorizador_id_fkey FOREIGN KEY (autorizador_id) REFERENCES usuario (id),
    ADD CONSTRAINT transferencias_despachador_id_fkey FOREIGN KEY (despachador_id) REFERENCES usuario (id),
    ADD CONSTRAINT transferencias_recibidor_id_fkey FOREIGN KEY (recibidor_id) REFERENCES usuario (id),
    ADD CONSTRAINT transferencias_resolutor_id_fkey FOREIGN KEY (resolutor_id) REFERENCES usuario (id),
    ADD CONSTRAINT transferencias_origen_distinto_destino_check CHECK (sucursal_origen_id <> sucursal_destino_id);

-- ------------------------------------------------------------
-- Ventas → listas de precios
-- ------------------------------------------------------------
-- La lista de la que salió el precio; NULL si se vendió al precio base. Las ventas anteriores quedan en NULL: no consta.
ALTER TABLE detalles_venta
    ADD COLUMN lista_precios_id bigint,
    ADD CONSTRAINT detalles_venta_lista_precios_id_fkey FOREIGN KEY (lista_precios_id) REFERENCES lista_precios (id);

-- ------------------------------------------------------------
-- Devoluciones → línea de la venta
-- ------------------------------------------------------------
-- Una venta puede repetir un producto con distinto precio: cada detalle devuelve una línea concreta.
ALTER TABLE detalles_devolucion_solicitud ADD COLUMN detalle_venta_id bigint;
CREATE INDEX idx_detalle_devolucion_linea ON detalles_devolucion_solicitud (detalle_venta_id);

-- Las devoluciones anteriores solo decían el producto: se asignan a sus líneas en orden, sin pasar de lo vendido en cada
-- una. Si un detalle abarca varias líneas se parte en una fila por línea; el precio guardado no cambia. Las solicitudes
-- rechazadas no consumieron unidades. Lo que sobre (se devolvió más de lo vendido) queda en la última línea, para no
-- alterar el historial. Un producto que no está en su venta no tiene arreglo automático y detiene la migración.
DO $$
DECLARE
    detail RECORD;
    line RECORD;
    remaining integer;
    available integer;
    taken integer;
    last_row bigint;
    first_chunk boolean;
BEGIN
    FOR detail IN
        SELECT d.id, d.solicitud_id, d.producto_id, d.cantidad, d.motivo_especifico, d.precio_unidad_venta, s.venta_id, s.estado
        FROM detalles_devolucion_solicitud d
        JOIN solicitudes_devolucion s ON s.id = d.solicitud_id
        ORDER BY (s.estado = 'RECHAZADA'), d.id
    LOOP
        IF NOT EXISTS (SELECT 1 FROM detalles_venta l WHERE l.venta_id = detail.venta_id AND l.producto_id = detail.producto_id) THEN
            RAISE EXCEPTION 'El detalle de devolución % es del producto %, que no está en la venta %', detail.id, detail.producto_id, detail.venta_id;
        END IF;

        remaining := detail.cantidad;
        first_chunk := true;
        last_row := detail.id;

        FOR line IN
            SELECT l.id, l.cantidad FROM detalles_venta l
            WHERE l.venta_id = detail.venta_id AND l.producto_id = detail.producto_id
            ORDER BY l.id
        LOOP
            IF detail.estado = 'RECHAZADA' THEN
                available := remaining;
            ELSE
                SELECT line.cantidad - COALESCE(SUM(d.cantidad), 0) INTO available
                FROM detalles_devolucion_solicitud d
                JOIN solicitudes_devolucion s ON s.id = d.solicitud_id
                WHERE d.detalle_venta_id = line.id AND s.estado <> 'RECHAZADA';
            END IF;
            taken := LEAST(remaining, available);

            IF taken > 0 THEN
                IF first_chunk THEN
                    UPDATE detalles_devolucion_solicitud SET detalle_venta_id = line.id, cantidad = taken WHERE id = detail.id;
                    first_chunk := false;
                ELSE
                    INSERT INTO detalles_devolucion_solicitud (solicitud_id, detalle_venta_id, producto_id, cantidad, motivo_especifico, precio_unidad_venta)
                    VALUES (detail.solicitud_id, line.id, detail.producto_id, taken, detail.motivo_especifico, detail.precio_unidad_venta)
                    RETURNING id INTO last_row;
                END IF;
                remaining := remaining - taken;
            END IF;

            EXIT WHEN remaining = 0;
        END LOOP;

        IF first_chunk THEN
            -- Ninguna línea tenía unidades libres: queda en la última línea del producto.
            UPDATE detalles_devolucion_solicitud d SET detalle_venta_id = (
                SELECT MAX(l.id) FROM detalles_venta l WHERE l.venta_id = detail.venta_id AND l.producto_id = detail.producto_id
            ) WHERE d.id = detail.id;
        ELSIF remaining > 0 THEN
            UPDATE detalles_devolucion_solicitud SET cantidad = cantidad + remaining WHERE id = last_row;
        END IF;
    END LOOP;
END $$;

-- Las FK compuestas garantizan que el producto del detalle sea el de su línea y que la sucursal de la solicitud sea la
-- de su venta (el stock devuelto vuelve a esa sucursal). Reemplazan a las FK simples, que quedan cubiertas por ellas.
ALTER TABLE detalles_venta ADD CONSTRAINT detalles_venta_id_producto_key UNIQUE (id, producto_id);
ALTER TABLE detalles_devolucion_solicitud
    ALTER COLUMN detalle_venta_id SET NOT NULL,
    -- Cuatro decimales, como calcula el backend: con dos, 3 unidades de una línea de 1000 devolverían 999,99.
    ALTER COLUMN precio_unidad_venta TYPE numeric(12, 4),
    DROP CONSTRAINT detalles_devolucion_solicitud_producto_id_fkey,
    ADD CONSTRAINT detalles_devolucion_solicitud_linea_producto_fkey FOREIGN KEY (detalle_venta_id, producto_id) REFERENCES detalles_venta (id, producto_id);

ALTER TABLE ventas ADD CONSTRAINT ventas_id_sucursal_key UNIQUE (id, sucursal_id);
ALTER TABLE solicitudes_devolucion
    DROP CONSTRAINT solicitudes_devolucion_venta_id_fkey,
    DROP CONSTRAINT solicitudes_devolucion_sucursal_id_fkey,
    ADD CONSTRAINT solicitudes_devolucion_venta_sucursal_fkey FOREIGN KEY (venta_id, sucursal_id) REFERENCES ventas (id, sucursal_id);

-- ------------------------------------------------------------
-- Unidades: la base es solo producto.unidad_id
-- ------------------------------------------------------------
DELETE FROM producto_unidad pu USING producto p WHERE pu.producto_id = p.id AND pu.unidad_id = p.unidad_id;
ALTER TABLE producto_unidad DROP COLUMN es_base;

-- ------------------------------------------------------------
-- Otros ajustes
-- ------------------------------------------------------------
-- El saldo del kardex con los mismos decimales que el stock.
ALTER TABLE movimiento_inventario ALTER COLUMN saldo_final TYPE numeric(12, 4);

-- Ningún código la usaba.
DROP TABLE rutas_logisticas;

-- ------------------------------------------------------------
-- Índices de las claves foráneas (PostgreSQL no las indexa solo)
-- ------------------------------------------------------------
CREATE INDEX idx_usuario_rol ON usuario (rol_id);
CREATE INDEX idx_usuario_sucursal ON usuario (sucursal_id);
CREATE INDEX idx_producto_unidad ON producto (unidad_id);
CREATE INDEX idx_producto_proveedor_proveedor ON producto_proveedor (proveedor_id);
CREATE INDEX idx_producto_unidad_unidad ON producto_unidad (unidad_id);
CREATE INDEX idx_precio_por_lista_producto ON precio_por_lista (producto_id);
CREATE INDEX idx_inventario_local_producto ON inventario_local (producto_id);
CREATE INDEX idx_movimiento_producto ON movimiento_inventario (producto_id);
CREATE INDEX idx_movimiento_sucursal ON movimiento_inventario (sucursal_id);
CREATE INDEX idx_movimiento_usuario ON movimiento_inventario (usuario_id);
CREATE INDEX idx_alerta_sucursal ON alertas_stock (sucursal_id);
CREATE INDEX idx_alerta_producto ON alertas_stock (producto_id);
CREATE INDEX idx_detalle_venta_venta ON detalles_venta (venta_id);
CREATE INDEX idx_detalle_venta_producto ON detalles_venta (producto_id);
CREATE INDEX idx_detalle_venta_lista ON detalles_venta (lista_precios_id);
CREATE INDEX idx_return_solicitante ON solicitudes_devolucion (solicitante_id);
CREATE INDEX idx_return_aprobador ON solicitudes_devolucion (aprobador_id);
CREATE INDEX idx_detalle_devolucion_solicitud ON detalles_devolucion_solicitud (solicitud_id);
CREATE INDEX idx_detalle_devolucion_producto ON detalles_devolucion_solicitud (producto_id);
CREATE INDEX idx_orden_proveedor ON ordenes_compra (proveedor_id);
CREATE INDEX idx_orden_usuario ON ordenes_compra (usuario_id);
CREATE INDEX idx_orden_usuario_recepcion ON ordenes_compra (usuario_recepcion_id);
CREATE INDEX idx_orden_resuelto_por ON ordenes_compra (resuelto_por_id);
CREATE INDEX idx_detalle_orden_orden ON detalles_orden_compra (orden_id);
CREATE INDEX idx_detalle_orden_producto ON detalles_orden_compra (producto_id);
CREATE INDEX idx_pagos_orden_compra_usuario ON pagos_orden_compra (usuario_id);
CREATE INDEX idx_transferencia_origen ON transferencias (sucursal_origen_id);
CREATE INDEX idx_transferencia_destino ON transferencias (sucursal_destino_id);
CREATE INDEX idx_transferencia_parent ON transferencias (parent_transfer_id);
CREATE INDEX idx_transferencia_solicitante ON transferencias (solicitante_id);
CREATE INDEX idx_transferencia_autorizador ON transferencias (autorizador_id);
CREATE INDEX idx_transferencia_despachador ON transferencias (despachador_id);
CREATE INDEX idx_transferencia_recibidor ON transferencias (recibidor_id);
CREATE INDEX idx_transferencia_resolutor ON transferencias (resolutor_id);
CREATE INDEX idx_detalle_transferencia_transferencia ON detalles_transferencia (transferencia_id);
CREATE INDEX idx_detalle_transferencia_producto ON detalles_transferencia (producto_id);
CREATE INDEX idx_pagos_traslado_usuario ON pagos_traslado (usuario_id);
