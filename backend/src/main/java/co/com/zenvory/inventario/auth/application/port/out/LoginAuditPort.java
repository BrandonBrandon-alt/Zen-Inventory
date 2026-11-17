package co.com.zenvory.inventario.auth.application.port.out;

import co.com.zenvory.inventario.auth.domain.model.LoginEvent;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;

import java.time.LocalDate;
import java.util.List;

/** Registro y consulta de los intentos de inicio de sesión. */
public interface LoginAuditPort {

    /** Guarda un intento. No debe hacer fallar el inicio de sesión si la base no responde: quien llama lo protege. */
    void record(String email, Long userId, LoginOutcome outcome, String ip);

    /** Filtros de la consulta; todos opcionales. `text` busca en el correo y en el nombre de la persona. */
    record Criteria(LocalDate from, LocalDate to, LoginOutcome outcome, String text) {
    }

    record Page(List<LoginEvent> content, long totalElements, long failures) {
    }

    /** Del más reciente al más antiguo. `failures` cuenta los intentos fallidos de todo lo filtrado. */
    Page search(Criteria criteria, int page, int size);
}
