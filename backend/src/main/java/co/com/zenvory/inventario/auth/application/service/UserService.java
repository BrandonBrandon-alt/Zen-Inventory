package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.DuplicateEmailException;
import co.com.zenvory.inventario.auth.domain.exception.RoleNotFoundException;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.exception.UserNotFoundException;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Servicio de aplicación que implementa la lógica de gestión de usuarios.
 * 
 * <p>Coordina las operaciones de creación, actualización y consulta de usuarios,
 * asegurando el cifrado de contraseñas mediante {@link PasswordEncoder} y la 
 * integridad referencial de los roles asignados.</p>
 */
@Service
public class UserService implements UserUseCase {

    private static final String ADMIN = "ADMIN";
    private static final String MANAGER = "MANAGER";
    /** Roles que un MANAGER puede asignar y administrar: siempre inferiores al suyo. */
    private static final Set<String> MANAGER_ASSIGNABLE = Set.of("SELLER", "OPERADOR_INVENTARIO");

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordEncoder passwordEncoder;
    private final BranchUseCase branchUseCase;

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param userRepositoryPort Puerto de salida para persistencia de usuarios.
     * @param passwordEncoder Componente para el hash de contraseñas.
     * @param branchUseCase Para comprobar que la sucursal asignada existe.
     */
    public UserService(UserRepositoryPort userRepositoryPort, PasswordEncoder passwordEncoder, BranchUseCase branchUseCase) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordEncoder = passwordEncoder;
        this.branchUseCase = branchUseCase;
    }

    @Override
    public List<User> getAllUsers(String actorEmail) {
        Long branchId = scopeBranch(actor(actorEmail));
        return branchId == null ? userRepositoryPort.findAll() : userRepositoryPort.findBySucursalId(branchId);
    }

    /**
     * {@inheritDoc}
     * @throws UserNotFoundException Si el identificador no corresponde a ningún usuario.
     */
    @Override
    public User getUserById(Long id, String actorEmail) {
        User actor = actor(actorEmail);
        User target = find(id);
        if (!isAdmin(actor)) {
            requireSameBranch(actor, target);
        }
        return target;
    }

    /**
     * {@inheritDoc}
     * <p>Cifra la contraseña antes de guardar. Un MANAGER crea siempre en su propia sucursal.</p>
     */
    @Override
    public User createUser(User user, String plainPassword, String actorEmail) {
        User actor = actor(actorEmail);
        if (plainPassword == null || plainPassword.isBlank()) {
            throw new IllegalArgumentException("La contraseña es obligatoria.");
        }
        Role role = findRole(user.getRole().getId());
        if (!isAdmin(actor)) {
            Long branchId = managerBranch(actor);
            requireAssignable(role);
            forceOwnBranch(user, branchId, "Solo puede crear usuarios en su propia sucursal.");
        }
        user.setEmail(normalizeEmail(user.getEmail()));
        requireUniqueEmail(user.getEmail(), null);
        requireBranchFor(role, user.getSucursalId());

        user.setPasswordHash(passwordEncoder.encode(plainPassword));
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setRole(role);
        return userRepositoryPort.save(user);
    }

    /**
     * {@inheritDoc}
     * <p>Actualización parcial: si plainPassword es nulo o vacío se conserva el hash existente. Un MANAGER solo
     * puede editar usuarios de su sucursal con rol inferior, y no puede moverlos de sucursal ni ascenderlos.</p>
     */
    @Override
    public User updateUser(Long id, User updated, String plainPassword, String actorEmail) {
        User actor = actor(actorEmail);
        User existing = find(id);
        Role newRole = updated.getRole() != null && updated.getRole().getId() != null
                ? findRole(updated.getRole().getId())
                : null;

        if (actor.getId().equals(existing.getId())) {
            requireNoSelfPrivilegeChange(existing, newRole, updated.getActive());
        }

        if (!isAdmin(actor)) {
            Long branchId = managerBranch(actor);
            requireManageable(actor, existing);
            if (newRole != null) {
                requireAssignable(newRole);
            }
            forceOwnBranch(updated, branchId, "No puede mover usuarios a otra sucursal.");
        }

        String email = normalizeEmail(updated.getEmail());
        requireUniqueEmail(email, existing.getId());
        // Actualización parcial: sin sucursalId o sin rol en la petición se conservan los actuales.
        Role effectiveRole = newRole != null ? newRole : existing.getRole();
        Long effectiveBranch = updated.getSucursalId() != null ? updated.getSucursalId() : existing.getSucursalId();
        requireBranchFor(effectiveRole, effectiveBranch);

        existing.setNombre(updated.getNombre());
        existing.setEmail(email);
        existing.setSucursalId(effectiveBranch);
        existing.setRole(effectiveRole);
        if (plainPassword != null && !plainPassword.isBlank()) {
            existing.setPasswordHash(passwordEncoder.encode(plainPassword));
        }
        if (updated.getActive() != null) {
            existing.setActive(updated.getActive());
        }
        return userRepositoryPort.save(existing);
    }

    /**
     * {@inheritDoc}
     * <p>Desactivación lógica para preservar la trazabilidad de auditoría.</p>
     */
    @Override
    public void deactivateUser(Long id, String actorEmail) {
        User actor = actor(actorEmail);
        User existing = find(id);
        if (actor.getId().equals(existing.getId())) {
            throw new UnauthorizedActionException("No puede desactivar su propia cuenta.");
        }
        if (!isAdmin(actor)) {
            requireManageable(actor, existing);
        }
        existing.setActive(false);
        userRepositoryPort.save(existing);
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public List<Role> getAssignableRoles(String actorEmail) {
        User actor = actor(actorEmail);
        List<Role> all = userRepositoryPort.findAllRoles();
        if (isAdmin(actor)) {
            return all;
        }
        managerBranch(actor);
        return all.stream().filter(role -> MANAGER_ASSIGNABLE.contains(role.getNombre())).toList();
    }

    // ---- Reglas de alcance ----

    private User actor(String email) {
        User actor = userRepositoryPort.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedActionException("No se pudo identificar al usuario autenticado."));
        if (Boolean.FALSE.equals(actor.getActive())) {
            throw new UnauthorizedActionException("Su usuario está desactivado.");
        }
        String role = actor.getRole().getNombre();
        if (!ADMIN.equals(role) && !MANAGER.equals(role)) {
            throw new UnauthorizedActionException("No tiene permisos para gestionar usuarios.");
        }
        return actor;
    }

    private boolean isAdmin(User actor) {
        return ADMIN.equals(actor.getRole().getNombre());
    }

    /** Sucursal a la que queda limitado quien ejecuta: {@code null} para ADMIN (sin límite). */
    private Long scopeBranch(User actor) {
        return isAdmin(actor) ? null : managerBranch(actor);
    }

    /** Rechaza una sucursal ajena y, si no se indicó ninguna, asigna la del MANAGER. */
    private void forceOwnBranch(User user, Long branchId, String message) {
        if (user.getSucursalId() != null && !branchId.equals(user.getSucursalId())) {
            throw new UnauthorizedActionException(message);
        }
        user.setSucursalId(branchId);
    }

    /** Sucursal del MANAGER; sin sucursal asignada no puede gestionar a nadie. */
    private Long managerBranch(User manager) {
        if (manager.getSucursalId() == null) {
            throw new UnauthorizedActionException("Su usuario no tiene una sucursal asignada.");
        }
        return manager.getSucursalId();
    }

    private void requireSameBranch(User manager, User target) {
        if (!managerBranch(manager).equals(target.getSucursalId())) {
            throw new UnauthorizedActionException("Solo puede gestionar usuarios de su propia sucursal.");
        }
    }

    /** El usuario objetivo debe ser de la sucursal del MANAGER y de un rol inferior (ni ADMIN ni MANAGER). */
    private void requireManageable(User manager, User target) {
        requireSameBranch(manager, target);
        if (!MANAGER_ASSIGNABLE.contains(target.getRole().getNombre())) {
            throw new UnauthorizedActionException("No puede gestionar usuarios con rol " + target.getRole().getNombre() + ".");
        }
    }

    /** Nadie cambia su propio rol ni se desactiva: evita auto-ascensos y dejar el sistema sin administradores. */
    private void requireNoSelfPrivilegeChange(User self, Role newRole, Boolean newActive) {
        if (newRole != null && !newRole.getId().equals(self.getRole().getId())) {
            throw new UnauthorizedActionException("No puede cambiar su propio rol.");
        }
        if (Boolean.FALSE.equals(newActive)) {
            throw new UnauthorizedActionException("No puede desactivar su propia cuenta.");
        }
    }

    /** El correo se guarda recortado y en minúsculas: es el identificador de inicio de sesión. */
    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void requireUniqueEmail(String email, Long ownerId) {
        userRepositoryPort.findByEmail(email)
                .filter(other -> !other.getId().equals(ownerId))
                .ifPresent(other -> {
                    throw new DuplicateEmailException();
                });
    }

    /** Todo rol salvo ADMIN pertenece a una sucursal que debe existir. */
    private void requireBranchFor(Role role, Long branchId) {
        if (ADMIN.equals(role.getNombre())) {
            return;
        }
        if (branchId == null) {
            throw new IllegalArgumentException("Debe indicar la sucursal del usuario.");
        }
        branchUseCase.getBranchById(branchId);
    }

    private void requireAssignable(Role role) {
        if (!MANAGER_ASSIGNABLE.contains(role.getNombre())) {
            throw new UnauthorizedActionException("No puede asignar el rol " + role.getNombre() + ".");
        }
    }

    private User find(Long id) {
        return userRepositoryPort.findById(id).orElseThrow(() -> new UserNotFoundException(id));
    }

    private Role findRole(Long id) {
        return userRepositoryPort.findRoleById(id)
                .orElseThrow(() -> new RoleNotFoundException(id));
    }
}
