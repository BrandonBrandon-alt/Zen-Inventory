package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;

/**
 * DTO (Data Transfer Object) de entrada para la creación de unidades de medida.
 * 
 * <p>Define los parámetros básicos del nomenclador de unidades, asegurando 
 * que se proporcione un nombre y una abreviatura única y válida.</p>
 *
 * @param nombre Nombre completo de la unidad (e.g., "Centímetros").
 * @param abreviatura Símbolo técnico representativo (e.g., "cm").
 */
public record UnitOfMeasureRequest(

        @NotBlank(message = "El nombre de la unidad es obligatorio")
        @Size(max = 50, message = "El nombre no puede superar los 50 caracteres")
        String nombre,

        @NotBlank(message = "La abreviatura es obligatoria")
        @Size(max = 10, message = "La abreviatura no puede superar los 10 caracteres")
        String abreviatura

) {}

