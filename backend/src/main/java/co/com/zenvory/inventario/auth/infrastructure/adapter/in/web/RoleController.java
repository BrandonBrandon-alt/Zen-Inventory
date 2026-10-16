package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.RoleResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada (Primary Adapter) para la consulta del catálogo de roles.
 * 
 * <p>Expone el listado de perfiles de acceso definidos en el sistema.
 * Devuelve los roles que quien consulta puede asignar: todos para 'ADMIN'; solo los inferiores para 'MANAGER'.</p>
 */
@RestController
@RequestMapping("/api/roles")
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class RoleController {

    private final UserUseCase userUseCase;

    /**
     * Constructor para inyección de dependencias.
     * @param userUseCase Puerto de entrada para la gestión de usuarios y roles.
     */
    public RoleController(UserUseCase userUseCase) {
        this.userUseCase = userUseCase;
    }

    /**
     * Obtiene el listado completo de roles disponibles en el sistema.
     * 
     * @return Lista de roles en formato {@link RoleResponse}.
     */
    @GetMapping
    public ResponseEntity<List<RoleResponse>> getAll(Principal principal) {
        List<RoleResponse> response = userUseCase.getAssignableRoles(principal.getName()).stream()
                .map(role -> RoleResponse.builder()
                        .id(role.getId())
                        .nombre(role.getNombre())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}

