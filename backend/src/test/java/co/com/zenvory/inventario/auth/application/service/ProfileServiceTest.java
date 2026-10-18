package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.out.AvatarProcessorPort;
import co.com.zenvory.inventario.auth.application.port.out.AvatarRepositoryPort;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ProfileService — cuenta propia")
class ProfileServiceTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final Map<Long, User> users = new HashMap<>();
    private final Map<Long, AvatarImage> stored = new HashMap<>();
    private final AvatarImage processed = new AvatarImage(new byte[] {1, 2, 3}, "image/jpeg");
    private boolean rejectImages;
    private ProfileService service;
    private User me;

    @BeforeEach
    void setUp() {
        me = User.builder().id(7L).nombre("Ana").email("ana@z.co").passwordHash(encoder.encode("secreto1"))
                .role(Role.builder().id(4L).nombre("SELLER").build()).sucursalId(1L).active(true).build();
        users.put(7L, me);
        UserRepositoryPort repo = new UserRepositoryPort() {
            @Override public Optional<User> findByEmail(String e) { return users.values().stream().filter(u -> u.getEmail().equals(e)).findFirst(); }
            @Override public Optional<User> findById(Long id) { return Optional.ofNullable(users.get(id)); }
            @Override public List<User> findAll() { return List.copyOf(users.values()); }
            @Override public List<User> findBySucursalId(Long id) { return List.of(); }
            @Override public User save(User u) { users.put(u.getId(), u); return u; }
            @Override public List<Role> findAllRoles() { return List.of(); }
            @Override public Optional<Role> findRoleById(Long id) { return Optional.empty(); }
        };
        AvatarRepositoryPort avatars = new AvatarRepositoryPort() {
            @Override public Optional<AvatarImage> findByUserId(Long id) { return Optional.ofNullable(stored.get(id)); }
            @Override public void save(Long id, AvatarImage image) { stored.put(id, image); }
            @Override public void deleteByUserId(Long id) { stored.remove(id); }
        };
        AvatarProcessorPort processor = bytes -> {
            if (rejectImages) throw new IllegalArgumentException("no es imagen");
            return processed;
        };
        service = new ProfileService(repo, avatars, processor, encoder);
    }

    @Test
    @DisplayName("cualquier rol consulta su perfil")
    void getsProfile() {
        assertThat(service.getProfile("ana@z.co").getId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("un usuario desactivado ya no puede tocar su cuenta")
    void disabledUserIsRejected() {
        me.setActive(false);
        assertThatThrownBy(() -> service.updateName("ana@z.co", "Otra")).isInstanceOf(UnauthorizedActionException.class);
    }

    @Test
    @DisplayName("cambia el nombre recortando y unificando espacios")
    void updatesNameTrimmed() {
        assertThat(service.updateName("ana@z.co", "  Ana   María  Pérez ").getNombre()).isEqualTo("Ana María Pérez");
        assertThat(users.get(7L).getNombre()).isEqualTo("Ana María Pérez");
    }

    @Test
    @DisplayName("un nombre vacío se rechaza y no cambia nada")
    void blankNameRejected() {
        assertThatThrownBy(() -> service.updateName("ana@z.co", "   ")).isInstanceOf(IllegalArgumentException.class);
        assertThat(me.getNombre()).isEqualTo("Ana");
    }

    @Test
    @DisplayName("cambiar el nombre no toca rol, sucursal ni contraseña")
    void nameChangeKeepsPrivileges() {
        String hash = me.getPasswordHash();
        service.updateName("ana@z.co", "Nueva");
        assertThat(me.getRole().getNombre()).isEqualTo("SELLER");
        assertThat(me.getSucursalId()).isEqualTo(1L);
        assertThat(me.getPasswordHash()).isEqualTo(hash);
    }

    @Test
    @DisplayName("cambia la contraseña cuando la actual es correcta")
    void changesPassword() {
        service.changePassword("ana@z.co", "secreto1", "nuevaClave");
        assertThat(encoder.matches("nuevaClave", me.getPasswordHash())).isTrue();
        assertThat(encoder.matches("secreto1", me.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("con la contraseña actual incorrecta no cambia nada")
    void wrongCurrentPassword() {
        String hash = me.getPasswordHash();
        assertThatThrownBy(() -> service.changePassword("ana@z.co", "mala", "nuevaClave"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("actual");
        assertThat(me.getPasswordHash()).isEqualTo(hash);
    }

    @Test
    @DisplayName("la contraseña nueva debe ser distinta de la actual")
    void sameNewPassword() {
        assertThatThrownBy(() -> service.changePassword("ana@z.co", "secreto1", "secreto1"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("distinta");
    }

    @Test
    @DisplayName("sube la foto: la guarda procesada y marca la versión")
    void changesAvatar() {
        User result = service.changeAvatar("ana@z.co", new byte[] {9});
        assertThat(stored.get(7L)).isSameAs(processed);
        assertThat(result.getAvatarUpdatedAt()).isNotNull();
        assertThat(service.getAvatar(7L)).contains(processed);
    }

    @Test
    @DisplayName("una imagen inválida no deja foto ni versión a medias")
    void invalidImageLeavesNothing() {
        rejectImages = true;
        assertThatThrownBy(() -> service.changeAvatar("ana@z.co", new byte[] {9})).isInstanceOf(IllegalArgumentException.class);
        assertThat(stored).isEmpty();
        assertThat(me.getAvatarUpdatedAt()).isNull();
    }

    @Test
    @DisplayName("quitar la foto la borra y limpia la versión")
    void removesAvatar() {
        service.changeAvatar("ana@z.co", new byte[] {9});
        User result = service.removeAvatar("ana@z.co");
        assertThat(stored).isEmpty();
        assertThat(result.getAvatarUpdatedAt()).isNull();
        assertThat(service.getAvatar(7L)).isEmpty();
    }

    @Test
    @DisplayName("cada quien solo modifica su propia foto")
    void onlyOwnAvatar() {
        User other = User.builder().id(8L).nombre("Bo").email("bo@z.co").passwordHash("x").role(me.getRole()).sucursalId(1L).active(true).build();
        users.put(8L, other);
        service.changeAvatar("ana@z.co", new byte[] {9});
        assertThat(stored.keySet()).containsExactly(7L);
        assertThat(other.getAvatarUpdatedAt()).isNull();
    }
}
