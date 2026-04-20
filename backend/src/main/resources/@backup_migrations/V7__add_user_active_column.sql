-- Migration: Add activo column to usuario table for soft-deletes
ALTER TABLE usuario ADD COLUMN activa BOOLEAN DEFAULT TRUE;

-- Update existing users to be active (though DEFAULT already handles it)
UPDATE usuario SET activa = TRUE;
