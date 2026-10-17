package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("CurrentUser — límites de sucursal")
class CurrentUserTest {

    private static CurrentUser of(String role, Long branch) {
        return new CurrentUser(User.builder().id(5L).role(Role.builder().nombre(role).build()).sucursalId(branch).build());
    }

    @Test
    @DisplayName("un MANAGER solo accede a su sucursal")
    void managerOnlyOwnBranch() {
        CurrentUser manager = of("MANAGER", 1L);
        assertThatCode(() -> manager.requireBranch(1L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> manager.requireBranch(2L)).isInstanceOf(UnauthorizedActionException.class);
        assertThatThrownBy(() -> manager.requireBranch(null)).isInstanceOf(UnauthorizedActionException.class);
    }

    @Test
    @DisplayName("un ADMIN accede a cualquier sucursal")
    void adminAnyBranch() {
        assertThatCode(() -> of("ADMIN", null).requireBranch(99L)).doesNotThrowAnyException();
        assertThat(of("ADMIN", null).isAdmin()).isTrue();
        assertThat(of("MANAGER", 1L).isAdmin()).isFalse();
    }

    @Test
    @DisplayName("resolveBranch: el no-admin opera en la suya; si pide otra, 403")
    void resolveBranchForNonAdmin() {
        CurrentUser seller = of("SELLER", 3L);
        assertThat(seller.resolveBranch(null)).isEqualTo(3L);
        assertThat(seller.resolveBranch(3L)).isEqualTo(3L);
        assertThatThrownBy(() -> seller.resolveBranch(4L)).isInstanceOf(UnauthorizedActionException.class);
    }

    @Test
    @DisplayName("resolveBranch: el ADMIN debe indicar la sucursal y se respeta")
    void resolveBranchForAdmin() {
        CurrentUser admin = of("ADMIN", null);
        assertThat(admin.resolveBranch(7L)).isEqualTo(7L);
        assertThatThrownBy(() -> admin.resolveBranch(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("un no-admin sin sucursal asignada no puede operar")
    void noBranchAssigned() {
        assertThatThrownBy(() -> of("MANAGER", null).resolveBranch(null)).isInstanceOf(UnauthorizedActionException.class);
        assertThatThrownBy(() -> of("MANAGER", null).requireBranch(1L)).isInstanceOf(UnauthorizedActionException.class);
    }
}
