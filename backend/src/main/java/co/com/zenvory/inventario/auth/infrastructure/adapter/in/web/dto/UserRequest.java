package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserRequest(
    @NotBlank(message = "El nombre es obligatorio")
    String nombre,
    
    @NotBlank(message = "El email es obligatorio")
    @Email(message = "Email inválido")
    String email,
    
    String password, // Solo obligatorio en creación
    
    @NotNull(message = "El rol es obligatorio")
    Long rolId,
    
    Long sucursalId,
    
    Boolean activo
) {}
