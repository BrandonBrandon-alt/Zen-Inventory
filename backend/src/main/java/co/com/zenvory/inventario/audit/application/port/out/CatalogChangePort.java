package co.com.zenvory.inventario.audit.application.port.out;

import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;

import java.time.LocalDate;
import java.util.List;

/** Dónde se guardan y se buscan los cambios del catálogo. */
public interface CatalogChangePort {

    /** Guarda las filas en la transacción en curso (si el cambio se revierte, su auditoría también). */
    void record(List<CatalogChange> changes);

    /** Del más reciente al más antiguo. */
    Page search(Criteria criteria, PageParams page);

    /** Cualquier campo nulo no filtra; {@code text} busca, sin tildes, en la entidad, el campo, los valores y quién. */
    record Criteria(ChangedEntity entity, LocalDate from, LocalDate to, String text) {
    }

    record Page(List<CatalogChange> content, long totalElements) {
    }
}
