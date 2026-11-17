package co.com.zenvory.inventario.auth.domain.model;

import java.time.LocalDateTime;

/** Un intento de inicio de sesión. `userId` y `userName` son nulos si el correo no es de ninguna cuenta. */
public record LoginEvent(Long id, LocalDateTime date, String email, Long userId, String userName, LoginOutcome outcome, String ip) {
}
