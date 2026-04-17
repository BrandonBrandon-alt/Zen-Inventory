package co.com.zenvory.inventario.auth.domain.model;

import lombok.Builder;

/**
 * Resultado de una autenticación exitosa.
 * Contiene el token generado y los datos clave del usuario.
 */
@Builder
public record LoginResult(
    String token,
    User user
) {}
