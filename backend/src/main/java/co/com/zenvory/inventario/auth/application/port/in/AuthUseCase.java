package co.com.zenvory.inventario.auth.application.port.in;

/**
 * Puerto de entrada para los casos de uso de autenticación.
 * El único caso de uso es el login: validar credenciales y retornar un JWT.
 */
import co.com.zenvory.inventario.auth.domain.model.LoginResult;

public interface AuthUseCase {
    LoginResult login(String email, String password);
}
