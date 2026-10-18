package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.AuthUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.model.LoginResult;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;

/**
 * Servicio de aplicación que implementa la orquestación del inicio de sesión.
 * 
 * <p>Responsabilidades:
 * <ul>
 *   <li>Validar la existencia del usuario en el almacén de datos.</li>
 *   <li>Verificar la integridad de la contraseña mediante {@link PasswordEncoder}.</li>
 *   <li>Validar si la cuenta se encuentra habilitada para operar.</li>
 *   <li>Solicitar la generación de tokens de acceso al {@link JwtService}.</li>
 * </ul>
 * </p>
 */
@Service
public class AuthService implements AuthUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptLimiter loginAttemptLimiter;
    /** Hash de relleno para igualar el tiempo de respuesta cuando el correo no existe. */
    private final String dummyHash;

    /**
     * Constructor para la inyección de dependencias.
     * 
     * @param userRepositoryPort Puerto de salida para acceso a datos de usuario.
     * @param jwtService Servicio para la gestión de tokens JWT.
     * @param passwordEncoder Componente de validación de hashes de contraseña.
     * @param loginAttemptLimiter Límite de intentos fallidos por correo.
     */
    public AuthService(
            UserRepositoryPort userRepositoryPort,
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            LoginAttemptLimiter loginAttemptLimiter) {
        this.userRepositoryPort = userRepositoryPort;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptLimiter = loginAttemptLimiter;
        this.dummyHash = passwordEncoder.encode("relleno-contra-enumeracion");
    }

    /**
     * {@inheritDoc}
     *
     * <p>Lanza {@link InvalidCredentialsException} para errores de identidad (email o contraseña) 
     * evitando revelar cuál de los dos falló por motivos de seguridad. 
     * Si las credenciales son correctas pero la cuenta está inactiva, lanza {@link AccountDisabledException}.</p>
     */
    @Override
    public LoginResult login(String email, String password) {
        String key = email.trim().toLowerCase(Locale.ROOT);
        loginAttemptLimiter.checkAllowed(key);

        Optional<User> found = userRepositoryPort.findByEmail(key);
        // Se compara siempre contra un hash (el real o uno de relleno): así un correo inexistente tarda lo mismo
        // que uno existente con contraseña errónea y no se puede averiguar qué cuentas existen midiendo tiempos.
        String hash = found.map(User::getPasswordHash).orElse(dummyHash);
        boolean passwordMatches = passwordEncoder.matches(password, hash);
        if (found.isEmpty() || !passwordMatches) {
            loginAttemptLimiter.recordFailure(key);
            throw new InvalidCredentialsException();
        }
        User user = found.get();
        loginAttemptLimiter.reset(key);

        if (user.getActive() != null && !user.getActive()) {
            throw new AccountDisabledException();
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());

        return LoginResult.builder()
                .token(token)
                .user(user)
                .build();
    }
}

