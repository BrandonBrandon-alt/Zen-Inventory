-- V29__add_received_quantity_to_purchase_details.sql
-- Add received quantity column to support partial reception
ALTER TABLE detalles_orden_compra ADD COLUMN cantidad_recibida DECIMAL(12, 4) DEFAULT 0.0;
