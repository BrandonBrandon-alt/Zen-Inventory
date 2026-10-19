package co.com.zenvory.inventario.auth.infrastructure.bootstrap;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("DefaultAccountsGuard — cuentas de ejemplo y administrador inicial")
class DefaultAccountsGuardTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private UserRepositoryPort users;

    @BeforeEach
    void setUp() {
        users = mock(UserRepositoryPort.class);
        when(users.findByEmail(any())).thenReturn(Optional.empty());
        when(users.findAllRoles()).thenReturn(List.of(Role.builder().id(1L).nombre("ADMIN").build()));
    }

    private DefaultAccountsGuard guard(String profile, String email, String password) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profile);
        return new DefaultAccountsGuard(users, encoder, env, email, password);
    }

    private User seedUser(String email, String password) {
        return User.builder().id(1L).email(email).passwordHash(encoder.encode(password)).active(true).build();
    }

    @Test
    @DisplayName("fuera de dev desactiva la cuenta de ejemplo que sigue con su contraseña publicada")
    void disablesSeedAccountWithDefaultPassword() {
        User admin = seedUser("admin@zeninventory.co", "admin123");
        when(users.findByEmail("admin@zeninventory.co")).thenReturn(Optional.of(admin));

        guard("prod", "", "").run(null);

        verify(users).save(admin);
        assertThat(admin.getActive()).isFalse();
    }

    @Test
    @DisplayName("si la cuenta de ejemplo ya tiene una contraseña propia, no se toca")
    void keepsSeedAccountWithChangedPassword() {
        User admin = seedUser("admin@zeninventory.co", "una-clave-propia-larga");
        when(users.findByEmail("admin@zeninventory.co")).thenReturn(Optional.of(admin));

        guard("prod", "", "").run(null);

        verify(users, never()).save(any());
        assertThat(admin.getActive()).isTrue();
    }

    @Test
    @DisplayName("en dev no hace nada: se sigue pudiendo entrar con los usuarios de ejemplo")
    void doesNothingInDev() {
        User admin = seedUser("admin@zeninventory.co", "admin123");
        when(users.findByEmail("admin@zeninventory.co")).thenReturn(Optional.of(admin));

        guard("dev", "otro@empresa.co", "una-clave-muy-larga-123").run(null);

        verify(users, never()).save(any());
        assertThat(admin.getActive()).isTrue();
    }

    @Test
    @DisplayName("crea el administrador inicial con el correo normalizado y la contraseña cifrada")
    void createsInitialAdmin() {
        guard("prod", "  Jefe@Empresa.co ", "una-clave-muy-larga-123").run(null);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().getEmail()).isEqualTo("jefe@empresa.co");
        assertThat(saved.getValue().getRole().getNombre()).isEqualTo("ADMIN");
        assertThat(saved.getValue().getActive()).isTrue();
        assertThat(saved.getValue().getPasswordHash()).isNotEqualTo("una-clave-muy-larga-123");
        assertThat(encoder.matches("una-clave-muy-larga-123", saved.getValue().getPasswordHash())).isTrue();
    }

    @Test
    @DisplayName("rechaza una contraseña inicial corta")
    void rejectsShortInitialPassword() {
        guard("prod", "jefe@empresa.co", "corta").run(null);

        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("no vuelve a crear ni cambia al administrador si ya existe")
    void doesNotRecreateExistingAdmin() {
        when(users.findByEmail("jefe@empresa.co")).thenReturn(Optional.of(seedUser("jefe@empresa.co", "la-que-ya-tenia-123")));

        guard("prod", "jefe@empresa.co", "una-clave-muy-larga-123").run(null);

        verify(users, never()).save(any());
    }
}
