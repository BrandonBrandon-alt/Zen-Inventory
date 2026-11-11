package co.com.zenvory.inventario.audit.application.service;

import co.com.zenvory.inventario.audit.application.port.in.CatalogAuditUseCase;
import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.shared.application.port.CurrentActorPort;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CatalogAuditService implements CatalogAuditUseCase {

    private final CatalogChangePort port;
    private final CurrentActorPort actor;

    public CatalogAuditService(CatalogChangePort port, CurrentActorPort actor) {
        this.port = port;
        this.actor = actor;
    }

    @Override
    public void record(ChangedEntity entity, Long entityId, String entityName, List<FieldChange> changes) {
        if (changes == null || changes.isEmpty()) {
            return;
        }
        CurrentActorPort.Actor who = actor.current();
        LocalDateTime now = LocalDateTime.now();
        port.record(changes.stream()
                .map(c -> new CatalogChange(null, now, entity, entityId, entityName, c.field(), c.before(), c.after(), who.id(), who.name()))
                .toList());
    }

    @Override
    public CatalogChangePort.Page search(CatalogChangePort.Criteria criteria, PageParams page) {
        return port.search(criteria, page);
    }
}
