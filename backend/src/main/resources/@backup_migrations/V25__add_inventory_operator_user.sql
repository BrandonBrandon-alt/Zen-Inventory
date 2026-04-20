-- ============================================================
-- V25: Agregar usuario Operador de Inventario
-- ============================================================

INSERT INTO usuario (nombre, email, password_hash, rol_id, sucursal_id)
SELECT 'Operador Inventario', 'inventario@zeninventory.co', '$2b$10$FDEIEVrwkQ6Hq.SxkRlBIe452C4VGAKHVrEfy7TCAXOkm//A1e.Sm', id, 1
FROM rol 
WHERE nombre = 'OPERADOR_INVENTARIO';
