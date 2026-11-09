package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.AuthUseCase;
import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.exception.TooManyLoginAttemptsException;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;
import co.com.zenvory.inventario.auth.domain.model.LoginResult;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final LoginAttemptLimiter loginAttemptLimiter;
    private final LoginAuditPort loginAudit;
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
            LoginAttemptLimiter loginAttemptLimiter,
            LoginAuditPort loginAudit) {
        this.userRepositoryPort = userRepositoryPort;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptLimiter = loginAttemptLimiter;
        this.loginAudit = loginAudit;
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
    public LoginResult login(String email, String password, String clientIp) {
        String key = email.trim().toLowerCase(Locale.ROOT);
        try {
            loginAttemptLimiter.checkAllowed(key);
        } catch (TooManyLoginAttemptsException blocked) {
            audit(key, null, LoginOutcome.BLOQUEADO, clientIp);
            throw blocked;
        }

        Optional<User> found = userRepositoryPort.findByEmail(key);
        // Se compara siempre contra un hash (el real o uno de relleno): así un correo inexistente tarda lo mismo
        // que uno existente con contraseña errónea y no se puede averiguar qué cuentas existen midiendo tiempos.
        String hash = found.map(User::getPasswordHash).orElse(dummyHash);
        boolean passwordMatches = passwordEncoder.matches(password, hash);
        if (found.isEmpty() || !passwordMatches) {
            loginAttemptLimiter.recordFailure(key);
            audit(key, found.map(User::getId).orElse(null), LoginOutcome.CREDENCIALES_INVALIDAS, clientIp);
            throw new InvalidCredentialsException();
        }
        User user = found.get();
        loginAttemptLimiter.reset(key);

        if (user.getActive() != null && !user.getActive()) {
            audit(key, user.getId(), LoginOutcome.CUENTA_DESACTIVADA, clientIp);
            throw new AccountDisabledException();
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail());
        audit(key, user.getId(), LoginOutcome.EXITOSO, clientIp);

        return LoginResult.builder()
                .token(token)
                .user(user)
                .build();
    }

    /** Registrar el intento nunca hace fallar el inicio de sesión: si la base no responde, se deja en el log. */
    private void audit(String email, Long userId, LoginOutcome outcome, String clientIp) {
        try {
            loginAudit.record(email, userId, outcome, clientIp);
        } catch (RuntimeException e) {
            log.warn("No se pudo registrar el intento de inicio de sesión ({}): {}", outcome, e.getMessage());
        }
    }
}

