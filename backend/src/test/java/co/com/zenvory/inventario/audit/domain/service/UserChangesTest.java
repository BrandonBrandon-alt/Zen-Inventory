package co.com.zenvory.inventario.audit.domain.service;

import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("UserChanges — qué cambió en un usuario")
class UserChangesTest {

    private static final Function<Long, String> BRANCHES = Map.of(1L, "Sucursal Norte", 2L, "Sucursal Sur")::get;

    private static User user(String role, Long branch, boolean active) {
        return User.builder().id(7L).nombre("Ana Ruiz").email("ana@x.co").role(Role.builder().nombre(role).build())
                .sucursalId(branch).active(active).build();
    }

    @Test
    @DisplayName("rol, sucursal y estado, con sus nombres")
    void rolSucursalYEstado() {
        assertThat(UserChanges.diff(user("SELLER", 1L, true), user("MANAGER", 2L, false), BRANCHES)).containsExactly(
                new FieldChange("Rol", "Vendedor", "Gerente"),
                new FieldChange("Sucursal", "Sucursal Norte", "Sucursal Sur"),
                new FieldChange("Estado", "Activo", "Inactivo"));
        assertThat(UserChanges.diff(user("MANAGER", 1L, true), user("ADMIN", null, true), BRANCHES)).containsExactly(
                new FieldChange("Rol", "Gerente", "Administrador"),
                new FieldChange("Sucursal", "Sucursal Norte", "—"));
    }

    @Test
    @DisplayName("crear una cuenta deja una fila «Cuenta» con el rol")
    void creacion() {
        assertThat(UserChanges.created(user("OPERADOR_INVENTARIO", 1L, true)))
                .isEqualTo(new FieldChange("Cuenta", "—", "Creada · Operador de inventario"));
    }

    @Test
    @DisplayName("sin cambios de rol, sucursal ni estado no devuelve nada (el nombre o la contraseña no se auditan)")
    void sinCambios_noDevuelveNada() {
        User after = user("SELLER", 1L, true);
        after.setNombre("Otro nombre");
        after.setPasswordHash("x");
        assertThat(UserChanges.diff(user("SELLER", 1L, true), after, BRANCHES)).isEmpty();
    }
}
