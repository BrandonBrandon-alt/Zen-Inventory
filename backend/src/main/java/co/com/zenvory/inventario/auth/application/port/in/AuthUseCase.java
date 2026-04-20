package co.com.zenvory.inventario.auth.application.port.in;

import co.com.zenvory.inventario.auth.domain.model.LoginResult;

/**
 * Puerto de entrada (Input Port) que define los servicios de autenticación y seguridad.
 * 
 * <p>Responsabilidad: Validar la identidad del usuario y proveer la semilla 
 * necesaria (JWT) para sesiones autenticadas.</p>
 */
public interface AuthUseCase {


    /**
     * Valida las credenciales de un usuario y genera un token de acceso.
     * 
     * @param email Correo electrónico de identidad.
     * @param password Contraseña proporcionada (será validada contra su hash).
     * @return {@link LoginResult} con el token generado y el perfil del usuario.
     * @throws co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException Si el correo no existe o la clave es incorrecta.
     * @throws co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException Si el usuario está marcado como inactivo.
     */
    LoginResult login(String email, String password);
}

