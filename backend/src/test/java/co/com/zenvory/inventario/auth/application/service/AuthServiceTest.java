package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.exception.TooManyLoginAttemptsException;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("AuthService — login")
class AuthServiceTest {

    private static final String DUMMY = "hash-de-relleno";

    private UserRepositoryPort repo;
    private PasswordEncoder encoder;
    private JwtService jwt;
    private LoginAttemptLimiter limiter;
    private AuthService service;
    private User ana;

    @BeforeEach
    void setUp() {
        repo = mock(UserRepositoryPort.class);
        encoder = mock(PasswordEncoder.class);
        jwt = mock(JwtService.class);
        limiter = new LoginAttemptLimiter();
        when(encoder.encode(any())).thenReturn(DUMMY);
        service = new AuthService(repo, jwt, encoder, limiter);
        ana = User.builder().id(7L).email("ana@x.co").passwordHash("hash-ana").active(true)
                .role(Role.builder().id(2L).nombre("MANAGER").build()).sucursalId(3L).build();
        when(repo.findByEmail("ana@x.co")).thenReturn(Optional.of(ana));
        when(repo.findByEmail("nadie@x.co")).thenReturn(Optional.empty());
        when(encoder.matches("buena", "hash-ana")).thenReturn(true);
        when(encoder.matches(any(), eq(DUMMY))).thenReturn(false);
        when(jwt.generateToken(7L, "ana@x.co")).thenReturn("jwt");
    }

    @Test
    @DisplayName("credenciales correctas: token atado al id y al correo del usuario")
    void success() {
        assertThat(service.login("ana@x.co", "buena").token()).isEqualTo("jwt");
    }

    @Test
    @DisplayName("el correo no distingue mayúsculas ni espacios")
    void emailNormalized() {
        assertThat(service.login("  ANA@x.co ", "buena").token()).isEqualTo("jwt");
    }

    @Test
    @DisplayName("correo inexistente: compara igualmente contra un hash de relleno (mismo tiempo que un correo real)")
    void unknownEmailStillHashes() {
        assertThatThrownBy(() -> service.login("nadie@x.co", "lo-que-sea")).isInstanceOf(InvalidCredentialsException.class);
        verify(encoder).matches("lo-que-sea", DUMMY);
    }

    @Test
    @DisplayName("contraseña errónea: mismo error que correo inexistente")
    void wrongPassword() {
        assertThatThrownBy(() -> service.login("ana@x.co", "mala")).isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    @DisplayName("cuenta desactivada con contraseña correcta: ACCOUNT_DISABLED")
    void disabled() {
        ana.setActive(false);
        assertThatThrownBy(() -> service.login("ana@x.co", "buena")).isInstanceOf(AccountDisabledException.class);
    }

    @Test
    @DisplayName("tras 5 fallos bloquea incluso la contraseña correcta, sin consultar usuarios")
    void lockout() {
        for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES; i++) {
            assertThatThrownBy(() -> service.login("ana@x.co", "mala")).isInstanceOf(InvalidCredentialsException.class);
        }
        assertThatThrownBy(() -> service.login("ana@x.co", "buena")).isInstanceOf(TooManyLoginAttemptsException.class);
    }

    @Test
    @DisplayName("un acierto antes del límite reinicia el contador")
    void successResets() {
        for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES - 1; i++) {
            assertThatThrownBy(() -> service.login("ana@x.co", "mala")).isInstanceOf(InvalidCredentialsException.class);
        }
        service.login("ana@x.co", "buena");
        for (int i = 0; i < LoginAttemptLimiter.MAX_FAILURES - 1; i++) {
            assertThatThrownBy(() -> service.login("ana@x.co", "mala")).isInstanceOf(InvalidCredentialsException.class);
        }
        assertThat(service.login("ana@x.co", "buena").token()).isEqualTo("jwt");
    }
}
