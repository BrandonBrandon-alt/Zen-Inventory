package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Objeto de transferencia (DTO) para la solicitud de inicio de sesión.
 * 
 * @param email Correo electrónico del usuario (requiere formato válido).
 * @param password Contraseña en texto plano para ser validada (no debe persistirse).
 */
public record LoginRequest(

        @NotBlank(message = "El email es obligatorio")
        @Email(message = "Formato de email inválido")
        String email,

        @NotBlank(message = "La contraseña es obligatoria")
        String password

) {}


