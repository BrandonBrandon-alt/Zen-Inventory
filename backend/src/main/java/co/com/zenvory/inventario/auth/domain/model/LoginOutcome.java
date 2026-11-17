package co.com.zenvory.inventario.auth.domain.model;

/** Cómo terminó un intento de inicio de sesión. */
public enum LoginOutcome {
    EXITOSO,
    /** Correo inexistente o contraseña errónea (no se distingue, para no revelar qué cuentas existen). */
    CREDENCIALES_INVALIDAS,
    CUENTA_DESACTIVADA,
    /** Demasiados intentos fallidos seguidos con ese correo. */
    BLOQUEADO
}
