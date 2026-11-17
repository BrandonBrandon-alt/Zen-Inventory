package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.shared.application.port.CurrentActorPort;
import org.springframework.stereotype.Component;

/** El actor actual sale de la sesión (el mismo {@link CurrentUser} que usan los controladores). */
@Component
public class SecurityCurrentActor implements CurrentActorPort {

    private final UserRepositoryPort users;

    public SecurityCurrentActor(UserRepositoryPort users) {
        this.users = users;
    }

    @Override
    public Actor current() {
        try {
            CurrentUser user = CurrentUser.resolve(users);
            return new Actor(user.id(), user.user().getNombre());
        } catch (UnauthorizedActionException noSession) {
            return Actor.SYSTEM;
        }
    }
}
