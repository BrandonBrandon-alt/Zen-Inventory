package co.com.zenvory.inventario.auth.domain.model;

import lombok.Builder;

/**
 * Representa el resultado exitoso de un proceso de autenticación.
 * 
 * <p>Encapsula el material de seguridad (token) y el contexto del usuario 
 * autenticado para ser procesado por los adaptadores de salida.</p>
 * 
 * @param token Cadena JWT que identifica la sesión.
 * @param user Modelo de dominio del usuario que inició sesión.
 */
@Builder
public record LoginResult(
    String token,
    User user
) {}

