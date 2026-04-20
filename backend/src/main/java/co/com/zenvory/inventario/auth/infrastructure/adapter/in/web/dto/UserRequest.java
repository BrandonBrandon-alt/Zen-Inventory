package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Objeto de transferencia (DTO) para la creación o actualización de un usuario.
 * 
 * @param nombre Nombre completo del usuario.
 * @param email Dirección de correo electrónico única.
 * @param password Contraseña del usuario (opcional en actualizaciones si no se desea cambiar).
 * @param rolId Identificador del rol a asignar.
 * @param sucursalId ID de la sucursal de pertenencia (opcional).
 * @param activo Estado de habilitación del usuario.
 */
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

