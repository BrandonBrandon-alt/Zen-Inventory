package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * DTO (Data Transfer Object) de salida para la representación de unidades de medida.
 * 
 * <p>Estructura los datos de las unidades para su consumo en la interfaz de usuario.
 * Proporciona el identificador, nombre y abreviatura técnica del nomenclador.</p>
 *
 * @param id Identificador único del recurso.
 * @param nombre Nombre descriptivo de la unidad.
 * @param abreviatura Símbolo técnico de la unidad.
 */
@Builder
public record UnitOfMeasureResponse(Long id, String nombre, String abreviatura) {}

