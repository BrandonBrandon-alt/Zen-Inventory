package co.com.zenvory.inventario.auth.application.port.in;

import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;

/** Consulta de los intentos de inicio de sesión (auditoría, solo ADMIN). */
public interface LoginAuditUseCase {

    LoginAuditPort.Page search(LoginAuditPort.Criteria criteria, int page, int size);
}
