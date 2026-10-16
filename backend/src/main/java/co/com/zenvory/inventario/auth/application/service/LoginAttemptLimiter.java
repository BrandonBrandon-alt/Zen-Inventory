package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.domain.exception.TooManyLoginAttemptsException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limita los intentos de inicio de sesión fallidos por correo para frenar la fuerza bruta.
 *
 * <p>Tras {@value #MAX_FAILURES} fallos dentro de {@link #WINDOW} el correo queda bloqueado hasta que la ventana
 * vence; un inicio de sesión correcto reinicia el contador. Es en memoria (por instancia): suficiente para una
 * sola réplica; con varias haría falta un almacén compartido. Se limita por correo y no por IP para no depender
 * de cabeceras falsificables; el bloqueo es temporal, así que alguien que conozca un correo solo puede
 * retrasar a su dueño unos minutos, no dejarlo fuera.</p>
 */
@Component
public class LoginAttemptLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);
    /** Por encima de este tamaño se purgan las entradas vencidas (evita crecer con correos inventados). */
    private static final int PURGE_THRESHOLD = 1_000;

    private record Attempts(int count, Instant windowStart) {}

    private final Clock clock;
    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptLimiter() {
        this(Clock.systemUTC());
    }

    LoginAttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    /** @throws TooManyLoginAttemptsException si el correo ya agotó sus intentos en la ventana actual. */
    public void checkAllowed(String key) {
        Attempts current = attempts.get(key);
        if (current != null && !expired(current) && current.count() >= MAX_FAILURES) {
            throw new TooManyLoginAttemptsException();
        }
    }

    public void recordFailure(String key) {
        Instant now = clock.instant();
        attempts.merge(key, new Attempts(1, now),
                (old, fresh) -> expired(old) ? fresh : new Attempts(old.count() + 1, old.windowStart()));
        if (attempts.size() > PURGE_THRESHOLD) {
            attempts.values().removeIf(this::expired);
        }
    }

    public void reset(String key) {
        attempts.remove(key);
    }

    private boolean expired(Attempts value) {
        return value.windowStart().plus(WINDOW).isBefore(clock.instant());
    }
}
