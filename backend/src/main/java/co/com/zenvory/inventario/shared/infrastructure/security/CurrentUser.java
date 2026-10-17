package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Usuario autenticado de la petición y sus límites de sucursal.
 *
 * <p>Es la fuente de verdad de "quién hace esto y en qué sucursal": los controladores y servicios la usan en lugar
 * de confiar en un {@code userId} o {@code branchId} que venga en el cuerpo de la petición (que cualquiera podría
 * falsificar para operar en otra sucursal o a nombre de otra persona). El ADMIN no está atado a una sucursal; el
 * resto solo opera en la suya.</p>
 */
public final class CurrentUser {

    private final User user;

    public CurrentUser(User user) {
        this.user = user;
    }

    /** Resuelve el usuario autenticado actual; sin sesión válida responde 403. */
    public static CurrentUser resolve(UserRepositoryPort users) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new UnauthorizedActionException("No se pudo identificar al usuario autenticado.");
        }
        // El filtro JWT ya cargó al usuario en esta petición: se reutiliza en vez de consultarlo otra vez.
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                && attributes.getRequest().getAttribute(JwtAuthenticationFilter.AUTHENTICATED_USER_ATTRIBUTE) instanceof User loaded
                && auth.getName().equals(loaded.getEmail())) {
            return new CurrentUser(loaded);
        }
        return new CurrentUser(users.findByEmail(auth.getName())
                .orElseThrow(() -> new UnauthorizedActionException("No se pudo identificar al usuario autenticado.")));
    }

    public User user() {
        return user;
    }

    public Long id() {
        return user.getId();
    }

    public boolean isAdmin() {
        return user.getRole() != null && "ADMIN".equals(user.getRole().getNombre());
    }

    /** Sucursal del usuario; {@code null} para quien no tiene (el ADMIN). */
    public Long branchId() {
        return user.getSucursalId();
    }

    /** @throws UnauthorizedActionException si no es ADMIN y la sucursal no es la suya. */
    public void requireBranch(Long branchId) {
        if (isAdmin()) {
            return;
        }
        if (branchId == null || !branchId.equals(user.getSucursalId())) {
            throw new UnauthorizedActionException("No tiene acceso a esa sucursal.");
        }
    }

    /**
     * Sucursal sobre la que opera: la propia para quien no es ADMIN (y si pide otra, 403); el ADMIN indica cuál.
     *
     * @throws UnauthorizedActionException si pide una sucursal ajena, o si el ADMIN no indica ninguna.
     */
    public Long resolveBranch(Long requested) {
        if (isAdmin()) {
            if (requested == null) {
                throw new IllegalArgumentException("Debe indicar la sucursal.");
            }
            return requested;
        }
        if (user.getSucursalId() == null) {
            throw new UnauthorizedActionException("Su usuario no tiene una sucursal asignada.");
        }
        if (requested != null && !requested.equals(user.getSucursalId())) {
            throw new UnauthorizedActionException("No tiene acceso a esa sucursal.");
        }
        return user.getSucursalId();
    }
}
