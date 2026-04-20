ALTER TABLE transferencias ADD COLUMN parent_transfer_id BIGINT REFERENCES transferencias(id);
