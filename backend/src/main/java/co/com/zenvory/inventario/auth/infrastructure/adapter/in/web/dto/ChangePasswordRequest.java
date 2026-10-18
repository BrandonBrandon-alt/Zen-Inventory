package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cambio de la contraseña propia: exige la actual para que una sesión ajena abierta no pueda cambiarla. */
public record ChangePasswordRequest(
    @NotBlank(message = "La contraseña actual es obligatoria")
    String contrasenaActual,

    @NotBlank(message = "La contraseña nueva es obligatoria")
    @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres")
    String contrasenaNueva
) {}
