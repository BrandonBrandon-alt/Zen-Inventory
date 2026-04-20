-- V33: Add comprehensive audit fields to transfers
ALTER TABLE transferencias 
ADD COLUMN solicitante_id BIGINT,
ADD COLUMN solicitante_nombre VARCHAR(255),
ADD COLUMN autorizador_id BIGINT,
ADD COLUMN autorizador_nombre VARCHAR(255),
ADD COLUMN despachador_id BIGINT,
ADD COLUMN despachador_nombre VARCHAR(255),
ADD COLUMN recibidor_id BIGINT,
ADD COLUMN recibidor_nombre VARCHAR(255),
ADD COLUMN resolutor_id BIGINT,
ADD COLUMN resolutor_nombre VARCHAR(255);

-- Migration of existing data (optional but good practice)
-- Note: resuelto_por_id already exists from previous phases, we sync it to resolutor_id if null
UPDATE transferencias SET resolutor_id = resuelto_por_id WHERE resolutor_id IS NULL;
