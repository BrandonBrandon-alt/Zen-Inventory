package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.RoleResponse;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.UserRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada (Primary Adapter) para la administración de usuarios.
 * 
 * <p>Proporciona endpoints para el CRUD de usuarios del sistema. Por seguridad,
 * todas las operaciones en este controlador están restringidas exclusivamente 
 * a usuarios con el rol 'ADMIN'.</p>
 */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserUseCase userUseCase;

    /**
     * Constructor para inyección de dependencias.
     * @param userUseCase Puerto de entrada para la lógica de gestión de usuarios.
     */
    public UserController(UserUseCase userUseCase) {
        this.userUseCase = userUseCase;
    }

    /**
     * Obtiene el listado completo de usuarios registrados.
     * 
     * @return Lista de usuarios en formato {@link UserResponse}.
     */
    @GetMapping
    public ResponseEntity<List<UserResponse>> getAll() {
        List<UserResponse> response = userUseCase.getAllUsers().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * Busca un usuario específico por su identificador único.
     * 
     * @param id ID del usuario.
     * @return Datos del usuario encontrado.
     */
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(userUseCase.getUserById(id)));
    }

    /**
     * Registra un nuevo usuario en el sistema.
     * 
     * @param request Datos del nuevo usuario (incluyendo contraseña).
     * @return El usuario creado con su ID asignado.
     */
    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody UserRequest request) {
        User userToCreate = User.builder()
                .nombre(request.nombre())
                .email(request.email())
                .role(Role.builder().id(request.rolId()).build())
                .sucursalId(request.sucursalId())
                .build();

        User saved = userUseCase.createUser(userToCreate, request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(saved));
    }

    /**
     * Actualiza la información de un usuario existente.
     * Permite cambiar el estado de activación, el rol y la contraseña (si se provee).
     * 
     * @param id ID del usuario a modificar.
     * @param request Nuevos datos del usuario.
     * @return El usuario con los cambios aplicados.
     */
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        User userData = User.builder()
                .nombre(request.nombre())
                .email(request.email())
                .role(request.rolId() != null ? Role.builder().id(request.rolId()).build() : null)
                .sucursalId(request.sucursalId())
                .active(request.activo())
                .build();

        User updated = userUseCase.updateUser(id, userData, request.password());
        return ResponseEntity.ok(mapToResponse(updated));
    }

    /**
     * Realiza un desactiva lógico (soft delete) de un usuario.
     * 
     * @param id ID del usuario a desactivar.
     * @return Respuesta sin contenido confirmando la operación.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        userUseCase.deactivateUser(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Método auxiliar de mapeo entre modelo de dominio y DTO de respuesta.
     */
    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .nombre(user.getNombre())
                .email(user.getEmail())
                .role(RoleResponse.builder()
                        .id(user.getRole().getId())
                        .nombre(user.getRole().getNombre())
                        .build())
                .sucursalId(user.getSucursalId())
                .activo(user.getActive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

