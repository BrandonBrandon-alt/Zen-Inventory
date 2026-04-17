package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;

/** DTO de entrada para crear una unidad de medida. */
public record UnitOfMeasureRequest(

        @NotBlank(message = "El nombre de la unidad es obligatorio")
        @Size(max = 50, message = "El nombre no puede superar los 50 caracteres")
        String nombre,

        @NotBlank(message = "La abreviatura es obligatoria")
        @Size(max = 10, message = "La abreviatura no puede superar los 10 caracteres")
        String abreviatura

) {}
