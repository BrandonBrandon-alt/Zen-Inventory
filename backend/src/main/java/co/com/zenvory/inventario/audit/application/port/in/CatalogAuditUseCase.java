package co.com.zenvory.inventario.audit.application.port.in;

import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;

import java.util.List;

/** Registrar y consultar los cambios de productos y usuarios. */
public interface CatalogAuditUseCase {

    /** Registra los campos que cambiaron, con quién y cuándo. Con la lista vacía no hace nada. */
    void record(ChangedEntity entity, Long entityId, String entityName, List<FieldChange> changes);

    CatalogChangePort.Page search(CatalogChangePort.Criteria criteria, PageParams page);
}
