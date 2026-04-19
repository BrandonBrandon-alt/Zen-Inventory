-- Agregando campos de logística avanzada (TMS) para Trackeo SLA en transferencias
ALTER TABLE transferencias ADD COLUMN prioridad VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE transferencias ADD COLUMN costo_envio DECIMAL(12,2);
ALTER TABLE transferencias ADD COLUMN numero_guia VARCHAR(100);
