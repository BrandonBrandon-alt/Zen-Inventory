package co.com.zenvory.inventario.audit.domain.service;

import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static co.com.zenvory.inventario.audit.domain.service.ChangeText.NONE;

/**
 * Qué cambió en un usuario: rol, sucursal y estado (lo que da o quita acceso). El nombre, el correo y la contraseña no
 * se auditan. Puro: el nombre de cada sucursal llega por {@code branchName}.
 */
public final class UserChanges {

    private static final Map<String, String> ROLES = Map.of(
            "ADMIN", "Administrador",
            "MANAGER", "Gerente",
            "SELLER", "Vendedor",
            "OPERADOR_INVENTARIO", "Operador de inventario");

    private UserChanges() {
    }

    public static List<FieldChange> diff(User before, User after, Function<Long, String> branchName) {
        List<FieldChange> changes = new ArrayList<>();
        String roleBefore = role(before.getRole());
        String roleAfter = role(after.getRole());
        if (!roleBefore.equals(roleAfter)) {
            changes.add(new FieldChange("Rol", roleBefore, roleAfter));
        }
        if (!ChangeText.same(before.getSucursalId(), after.getSucursalId())) {
            changes.add(new FieldChange("Sucursal", branch(before.getSucursalId(), branchName), branch(after.getSucursalId(), branchName)));
        }
        if (!ChangeText.active(before.getActive()).equals(ChangeText.active(after.getActive()))) {
            changes.add(new FieldChange("Estado", ChangeText.active(before.getActive()), ChangeText.active(after.getActive())));
        }
        return changes;
    }

    public static FieldChange created(User user) {
        return new FieldChange("Cuenta", NONE, "Creada · " + role(user.getRole()));
    }

    /** Una copia de lo que se audita, para comparar después de modificar el usuario en sitio. */
    public static User snapshot(User user) {
        return User.builder().id(user.getId()).nombre(user.getNombre()).role(user.getRole())
                .sucursalId(user.getSucursalId()).active(user.getActive()).build();
    }

    private static String role(Role role) {
        if (role == null || role.getNombre() == null) {
            return NONE;
        }
        return ROLES.getOrDefault(role.getNombre(), role.getNombre());
    }

    private static String branch(Long id, Function<Long, String> branchName) {
        return id == null ? NONE : branchName.apply(id);
    }
}
