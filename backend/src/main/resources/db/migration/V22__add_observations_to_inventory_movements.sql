-- V22: Add observations column to inventory movement table for audit traceability
ALTER TABLE movimiento_inventario ADD COLUMN observaciones VARCHAR(255);
