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

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')") // Solo los administradores pueden gestionar usuarios
public class UserController {

    private final UserUseCase userUseCase;

    public UserController(UserUseCase userUseCase) {
        this.userUseCase = userUseCase;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAll() {
        List<UserResponse> response = userUseCase.getAllUsers().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(userUseCase.getUserById(id)));
    }

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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        userUseCase.deactivateUser(id);
        return ResponseEntity.noContent().build();
    }

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
