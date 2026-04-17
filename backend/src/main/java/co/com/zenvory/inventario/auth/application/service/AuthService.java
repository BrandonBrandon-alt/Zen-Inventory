package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.AuthUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.model.LoginResult;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Servicio de aplicación que implementa el caso de uso de Login.
 *
 * <p>Orquesta:
 * <ol>
 *   <li>Busca el usuario por email en la BD (puerto de salida).</li>
 *   <li>Verifica la contraseña con BCrypt.</li>
 *   <li>Delega al {@link JwtService} para generar el token.</li>
 * </ol>
 */
@Service
public class AuthService implements AuthUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepositoryPort userRepositoryPort,
            JwtService jwtService,
            PasswordEncoder passwordEncoder) {
        this.userRepositoryPort = userRepositoryPort;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * {@inheritDoc}
     *
     * <p>Siempre lanza {@link InvalidCredentialsException} tanto para email inexistente
     * como para contraseña incorrecta — evita revelar cuál de los dos falló (enumeración).</p>
     */
    @Override
    public LoginResult login(String email, String password) {
        User user = userRepositoryPort.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getRole().getNombre(),
                user.getSucursalId()
        );

        return LoginResult.builder()
                .token(token)
                .user(user)
                .build();
    }
}
