package co.com.zenvory.inventario.audit.domain.model;

import java.time.LocalDateTime;

/**
 * Una fila de la auditoría del catálogo: qué campo de qué producto o usuario cambió, de qué a qué, quién y cuándo.
 * {@code entityName} y {@code userName} son una foto del momento del cambio.
 */
public record CatalogChange(Long id, LocalDateTime date, ChangedEntity entity, Long entityId, String entityName,
                            String field, String before, String after, Long userId, String userName) {
}
