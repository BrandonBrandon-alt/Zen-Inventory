package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.exception.UserNotFoundException;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("UserService — alcance por rol")
class UserServiceTest {

    private static final Role ADMIN = Role.builder().id(1L).nombre("ADMIN").build();
    private static final Role MANAGER = Role.builder().id(2L).nombre("MANAGER").build();
    private static final Role OPERADOR = Role.builder().id(3L).nombre("OPERADOR_INVENTARIO").build();
    private static final Role SELLER = Role.builder().id(4L).nombre("SELLER").build();
    private static final long MY_BRANCH = 10L;
    private static final long OTHER_BRANCH = 20L;

    /** Repositorio en memoria: permite comprobar el estado guardado, no solo las llamadas. */
    private static final class FakeRepo implements UserRepositoryPort {
        final List<User> users = new ArrayList<>();
        final List<Role> roles = List.of(ADMIN, MANAGER, OPERADOR, SELLER);
        long nextId = 100;

        User add(String email, Role role, Long branch) {
            User u = User.builder().id(nextId++).nombre(email).email(email).role(role).sucursalId(branch).active(true).build();
            users.add(u);
            return u;
        }

        @Override public Optional<User> findByEmail(String email) { return users.stream().filter(u -> u.getEmail().equals(email)).findFirst(); }
        @Override public Optional<User> findById(Long id) { return users.stream().filter(u -> u.getId().equals(id)).findFirst(); }
        @Override public List<User> findAll() { return List.copyOf(users); }
        @Override public User save(User user) {
            if (user.getId() == null) { user.setId(nextId++); users.add(user); }
            return user;
        }
        @Override public List<Role> findAllRoles() { return roles; }
        @Override public Optional<Role> findRoleById(Long id) { return roles.stream().filter(r -> r.getId().equals(id)).findFirst(); }
    }

    private FakeRepo repo;
    private UserService service;
    private User admin;
    private User manager;
    private User mySeller;
    private User myManager2;
    private User otherSeller;

    @BeforeEach
    void setUp() {
        repo = new FakeRepo();
        PasswordEncoder encoder = new PasswordEncoder() {
            @Override public String encode(CharSequence raw) { return "hash:" + raw; }
            @Override public boolean matches(CharSequence raw, String encoded) { return encoded.equals("hash:" + raw); }
        };
        service = new UserService(repo, encoder);
        admin = repo.add("admin@x.co", ADMIN, null);
        manager = repo.add("manager@x.co", MANAGER, MY_BRANCH);
        mySeller = repo.add("seller@x.co", SELLER, MY_BRANCH);
        myManager2 = repo.add("manager2@x.co", MANAGER, MY_BRANCH);
        otherSeller = repo.add("other@x.co", SELLER, OTHER_BRANCH);
    }

    private User newUser(Role role, Long branch) {
        return User.builder().nombre("Nuevo").email("nuevo@x.co").role(Role.builder().id(role.getId()).build()).sucursalId(branch).build();
    }

    @Nested
    @DisplayName("quién puede gestionar usuarios")
    class Actors {
        @Test
        @DisplayName("SELLER y OPERADOR no pueden (aunque el controlador ya lo bloquea)")
        void lowRolesRejected() {
            repo.add("op@x.co", OPERADOR, MY_BRANCH);
            assertThatThrownBy(() -> service.getAllUsers("seller@x.co")).isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.getAllUsers("op@x.co")).isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("un MANAGER o ADMIN desactivado pierde el acceso aunque su token siga vigente")
        void deactivatedActorRejected() {
            manager.setActive(false);
            admin.setActive(false);
            assertThatThrownBy(() -> service.getAllUsers("manager@x.co")).isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.getAllUsers("admin@x.co")).isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("un actor desconocido es rechazado")
        void unknownActor() {
            assertThatThrownBy(() -> service.getAllUsers("nadie@x.co")).isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("un MANAGER sin sucursal no puede gestionar a nadie")
        void managerWithoutBranch() {
            repo.add("sinsede@x.co", MANAGER, null);
            assertThatThrownBy(() -> service.getAllUsers("sinsede@x.co")).isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.createUser(newUser(SELLER, null), "secret1", "sinsede@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
        }
    }

    @Nested
    @DisplayName("listar y consultar")
    class Reading {
        @Test
        @DisplayName("ADMIN ve todos")
        void adminSeesAll() {
            assertThat(service.getAllUsers("admin@x.co")).hasSize(5);
        }

        @Test
        @DisplayName("MANAGER ve solo los de su sucursal")
        void managerSeesOwnBranch() {
            assertThat(service.getAllUsers("manager@x.co")).extracting(User::getEmail)
                    .containsExactlyInAnyOrder("manager@x.co", "seller@x.co", "manager2@x.co");
        }

        @Test
        @DisplayName("MANAGER consulta uno de su sucursal pero no de otra")
        void managerGetById() {
            assertThat(service.getUserById(mySeller.getId(), "manager@x.co")).isSameAs(mySeller);
            assertThatThrownBy(() -> service.getUserById(otherSeller.getId(), "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("ADMIN consulta cualquiera; uno inexistente es 404")
        void adminGetById() {
            assertThat(service.getUserById(otherSeller.getId(), "admin@x.co")).isSameAs(otherSeller);
            assertThatThrownBy(() -> service.getUserById(9999L, "admin@x.co")).isInstanceOf(UserNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("crear")
    class Creating {
        @Test
        @DisplayName("ADMIN crea cualquier rol en cualquier sucursal, con la contraseña cifrada y activo")
        void adminCreatesAnywhere() {
            User created = service.createUser(newUser(MANAGER, OTHER_BRANCH), "secret1", "admin@x.co");
            assertThat(created.getRole().getNombre()).isEqualTo("MANAGER");
            assertThat(created.getSucursalId()).isEqualTo(OTHER_BRANCH);
            assertThat(created.getPasswordHash()).isEqualTo("hash:secret1");
            assertThat(created.getActive()).isTrue();
        }

        @Test
        @DisplayName("MANAGER crea SELLER y OPERADOR en su sucursal")
        void managerCreatesLowerRoles() {
            assertThat(service.createUser(newUser(SELLER, MY_BRANCH), "secret1", "manager@x.co").getSucursalId()).isEqualTo(MY_BRANCH);
            assertThat(service.createUser(newUser(OPERADOR, MY_BRANCH), "secret1", "manager@x.co").getRole().getNombre())
                    .isEqualTo("OPERADOR_INVENTARIO");
        }

        @Test
        @DisplayName("MANAGER sin indicar sucursal crea en la suya")
        void managerDefaultsToOwnBranch() {
            assertThat(service.createUser(newUser(SELLER, null), "secret1", "manager@x.co").getSucursalId()).isEqualTo(MY_BRANCH);
        }

        @Test
        @DisplayName("MANAGER no puede crear ADMIN ni otro MANAGER")
        void managerCannotCreateEqualOrHigher() {
            assertThatThrownBy(() -> service.createUser(newUser(ADMIN, MY_BRANCH), "secret1", "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.createUser(newUser(MANAGER, MY_BRANCH), "secret1", "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("MANAGER no puede crear en otra sucursal")
        void managerCannotCreateElsewhere() {
            int before = repo.users.size();
            assertThatThrownBy(() -> service.createUser(newUser(SELLER, OTHER_BRANCH), "secret1", "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThat(repo.users).hasSize(before);
        }
    }

    @Nested
    @DisplayName("actualizar")
    class Updating {
        private User changes(Role role, Long branch) {
            return User.builder().nombre("Editado").email("editado@x.co").role(role == null ? null : Role.builder().id(role.getId()).build())
                    .sucursalId(branch).build();
        }

        @Test
        @DisplayName("ADMIN puede cambiar rol y sucursal de cualquiera")
        void adminUpdatesAnything() {
            User updated = service.updateUser(otherSeller.getId(), changes(MANAGER, MY_BRANCH), null, "admin@x.co");
            assertThat(updated.getRole().getNombre()).isEqualTo("MANAGER");
            assertThat(updated.getSucursalId()).isEqualTo(MY_BRANCH);
        }

        @Test
        @DisplayName("MANAGER edita a un SELLER de su sede, conservando la sucursal y el hash si no hay contraseña")
        void managerUpdatesOwnLowerUser() {
            mySeller.setPasswordHash("hash:viejo");
            User updated = service.updateUser(mySeller.getId(), changes(OPERADOR, null), "", "manager@x.co");
            assertThat(updated.getNombre()).isEqualTo("Editado");
            assertThat(updated.getRole().getNombre()).isEqualTo("OPERADOR_INVENTARIO");
            assertThat(updated.getSucursalId()).isEqualTo(MY_BRANCH);
            assertThat(updated.getPasswordHash()).isEqualTo("hash:viejo");
        }

        @Test
        @DisplayName("MANAGER no puede editar usuarios de otra sucursal")
        void managerCannotEditOtherBranch() {
            assertThatThrownBy(() -> service.updateUser(otherSeller.getId(), changes(SELLER, null), null, "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("MANAGER no puede editar a otro MANAGER ni a un ADMIN")
        void managerCannotEditEqualOrHigher() {
            assertThatThrownBy(() -> service.updateUser(myManager2.getId(), changes(SELLER, null), null, "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.updateUser(admin.getId(), changes(SELLER, null), null, "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
        }

        @Test
        @DisplayName("MANAGER no puede ascender a alguien ni moverlo de sucursal")
        void managerCannotPromoteOrMove() {
            assertThatThrownBy(() -> service.updateUser(mySeller.getId(), changes(MANAGER, null), null, "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThatThrownBy(() -> service.updateUser(mySeller.getId(), changes(SELLER, OTHER_BRANCH), null, "manager@x.co"))
                    .isInstanceOf(UnauthorizedActionException.class);
            assertThat(mySeller.getRole().getNombre()).isEqualTo("SELLER");
            assertThat(mySeller.getSucursalId()).isEqualTo(MY_BRANCH);
        }
    }

    @Nested
    @DisplayName("desactivar")
    class Deactivating {
        @Test
        @DisplayName("ADMIN desactiva a cualquiera")
        void adminDeactivates() {
            service.deactivateUser(otherSeller.getId(), "admin@x.co");
            assertThat(otherSeller.getActive()).isFalse();
        }

        @Test
        @DisplayName("MANAGER desactiva a un SELLER de su sede")
        void managerDeactivatesOwn() {
            service.deactivateUser(mySeller.getId(), "manager@x.co");
            assertThat(mySeller.getActive()).isFalse();
        }

        @Test
        @DisplayName("MANAGER no desactiva a otra sucursal, a otro MANAGER ni a un ADMIN")
        void managerCannotDeactivateOthers() {
            for (User target : List.of(otherSeller, myManager2, admin)) {
                assertThatThrownBy(() -> service.deactivateUser(target.getId(), "manager@x.co"))
                        .isInstanceOf(UnauthorizedActionException.class);
                assertThat(target.getActive()).isTrue();
            }
        }
    }

    @Nested
    @DisplayName("roles asignables")
    class Roles {
        @Test
        @DisplayName("ADMIN ve los cuatro; MANAGER solo SELLER y OPERADOR_INVENTARIO")
        void assignableRoles() {
            assertThat(service.getAssignableRoles("admin@x.co")).hasSize(4);
            assertThat(service.getAssignableRoles("manager@x.co")).extracting(Role::getNombre)
                    .containsExactlyInAnyOrder("SELLER", "OPERADOR_INVENTARIO");
        }
    }
}
