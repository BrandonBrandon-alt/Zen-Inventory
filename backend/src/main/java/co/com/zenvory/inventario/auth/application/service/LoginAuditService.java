package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.LoginAuditUseCase;
import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import org.springframework.stereotype.Service;

/** Acota página y tamaño (hasta 100 por página), como las demás consultas paginadas. */
@Service
public class LoginAuditService implements LoginAuditUseCase {

    static final int MAX_PAGE_SIZE = 100;

    private final LoginAuditPort port;

    public LoginAuditService(LoginAuditPort port) {
        this.port = port;
    }

    @Override
    public LoginAuditPort.Page search(LoginAuditPort.Criteria criteria, int page, int size) {
        return port.search(criteria, Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE));
    }
}
