-- V23: Add sub_reason column to inventory movement table for shrinkage categorization
ALTER TABLE movimiento_inventario ADD COLUMN sub_motivo VARCHAR(100);
