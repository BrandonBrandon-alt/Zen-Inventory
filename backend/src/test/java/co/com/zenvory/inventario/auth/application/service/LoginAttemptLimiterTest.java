package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.domain.exception.TooManyLoginAttemptsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("LoginAttemptLimiter")
class LoginAttemptLimiterTest {

    /** Reloj manual: permite avanzar el tiempo sin esperar. */
    private static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T10:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration d) { now = now.plus(d); }
    }

    private MutableClock clock;
    private LoginAttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        limiter = new LoginAttemptLimiter(clock);
    }

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) limiter.recordFailure(key);
    }

    @Test
    @DisplayName("permite hasta el máximo de fallos y bloquea el siguiente intento")
    void blocksAfterMaxFailures() {
        fail("a@x.co", LoginAttemptLimiter.MAX_FAILURES - 1);
        assertThatCode(() -> limiter.checkAllowed("a@x.co")).doesNotThrowAnyException();
        limiter.recordFailure("a@x.co");
        assertThatThrownBy(() -> limiter.checkAllowed("a@x.co")).isInstanceOf(TooManyLoginAttemptsException.class);
    }

    @Test
    @DisplayName("el bloqueo es por correo: otro correo no se ve afectado")
    void perKey() {
        fail("a@x.co", LoginAttemptLimiter.MAX_FAILURES);
        assertThatCode(() -> limiter.checkAllowed("b@x.co")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("el bloqueo vence con la ventana")
    void expires() {
        fail("a@x.co", LoginAttemptLimiter.MAX_FAILURES);
        clock.advance(LoginAttemptLimiter.WINDOW.plusSeconds(1));
        assertThatCode(() -> limiter.checkAllowed("a@x.co")).doesNotThrowAnyException();
        // y el contador empieza de nuevo
        fail("a@x.co", LoginAttemptLimiter.MAX_FAILURES - 1);
        assertThatCode(() -> limiter.checkAllowed("a@x.co")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("un inicio de sesión correcto reinicia el contador")
    void resetClears() {
        fail("a@x.co", LoginAttemptLimiter.MAX_FAILURES);
        limiter.reset("a@x.co");
        assertThatCode(() -> limiter.checkAllowed("a@x.co")).doesNotThrowAnyException();
    }
}
