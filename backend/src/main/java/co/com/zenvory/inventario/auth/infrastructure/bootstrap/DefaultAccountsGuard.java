package co.com.zenvory.inventario.auth.infrastructure.bootstrap;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Cierra la puerta de las cuentas de ejemplo al arrancar fuera de desarrollo.
 *
 * <p>La migración V2 crea tres usuarios con contraseñas publicadas en el repositorio ({@code admin123}…): en una
 * base real serían una entrada abierta de ADMIN. Con un perfil distinto de {@code dev}, este arranque:</p>
 * <ol>
 *   <li><b>Desactiva</b> cada una de esas cuentas mientras conserve su contraseña de ejemplo. Si alguien ya le puso
 *       una propia, no se toca.</li>
 *   <li>Si se definen {@code INITIAL_ADMIN_EMAIL} e {@code INITIAL_ADMIN_PASSWORD} (mínimo 12 caracteres), crea ese
 *       administrador cuando aún no existe: es la forma de entrar a una base nueva sin cuentas conocidas.</li>
 * </ol>
 * En {@code dev} no hace nada, para poder seguir probando con los usuarios de ejemplo.
 */
@Component
public class DefaultAccountsGuard implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DefaultAccountsGuard.class);

    /** Cuentas de la migración V2 y la contraseña con la que nacen (ambas públicas en el repositorio). */
    static final Map<String, String> SEED_ACCOUNTS = Map.of(
            "admin@zeninventory.co", "admin123",
            "gerente@zeninventory.co", "gerente123",
            "operador@zeninventory.co", "operador123");

    static final int MIN_PASSWORD_LENGTH = 12;

    private final UserRepositoryPort users;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;
    private final String adminEmail;
    private final String adminPassword;

    public DefaultAccountsGuard(
            UserRepositoryPort users,
            PasswordEncoder passwordEncoder,
            Environment environment,
            @Value("${INITIAL_ADMIN_EMAIL:}") String adminEmail,
            @Value("${INITIAL_ADMIN_PASSWORD:}") String adminPassword) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
        this.adminEmail = adminEmail == null ? "" : adminEmail.trim().toLowerCase();
        this.adminPassword = adminPassword == null ? "" : adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (environment.acceptsProfiles(Profiles.of("dev"))) {
            return;
        }
        disableSeedAccounts();
        createInitialAdmin();
    }

    private void disableSeedAccounts() {
        SEED_ACCOUNTS.forEach((email, defaultPassword) ->
                users.findByEmail(email).ifPresent(user -> {
                    boolean stillDefault = Boolean.TRUE.equals(user.getActive())
                            && passwordEncoder.matches(defaultPassword, user.getPasswordHash());
                    if (stillDefault) {
                        user.setActive(false);
                        users.save(user);
                        log.warn("Cuenta de ejemplo desactivada porque conserva su contraseña publicada: {}", email);
                    }
                }));
    }

    private void createInitialAdmin() {
        if (adminEmail.isEmpty() && adminPassword.isEmpty()) {
            return;
        }
        if (adminEmail.isEmpty() || adminPassword.length() < MIN_PASSWORD_LENGTH) {
            log.warn("No se creó el administrador inicial: hacen falta INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD de al menos {} caracteres.", MIN_PASSWORD_LENGTH);
            return;
        }
        if (users.findByEmail(adminEmail).isPresent()) {
            return;
        }
        Role adminRole = users.findAllRoles().stream()
                .filter(role -> "ADMIN".equals(role.getNombre()))
                .findFirst()
                .orElse(null);
        if (adminRole == null) {
            log.warn("No se creó el administrador inicial: no existe el rol ADMIN.");
            return;
        }
        users.save(User.builder()
                .nombre("Administrador")
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(adminRole)
                .active(true)
                .build());
        log.info("Administrador inicial creado: {}", adminEmail);
    }
}
