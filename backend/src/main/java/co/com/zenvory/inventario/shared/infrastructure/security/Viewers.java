package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.shared.domain.Viewer;

/** Traduce el usuario de la sesión a un {@link Viewer} del dominio. */
public final class Viewers {

    private Viewers() {
    }

    public static Viewer from(CurrentUser current) {
        String role = current.user().getRole() == null ? null : current.user().getRole().getNombre();
        boolean admin = "ADMIN".equals(role);
        boolean manager = admin || "MANAGER".equals(role);
        boolean operational = manager || "OPERADOR_INVENTARIO".equals(role);
        return new Viewer(admin, manager, operational, admin ? null : current.branchId());
    }
}
