package co.com.zenvory.inventario.shared.infrastructure.web;

/**
 * Códigos de error estables del contrato de la API.
 *
 * <p>El frontend decide su comportamiento por estos códigos (no por el texto del mensaje, que puede cambiar).
 * Agregar un código nuevo es compatible; renombrar o eliminar uno rompe a los clientes.</p>
 */
public enum ErrorCode {
    // Autenticación y autorización
    INVALID_CREDENTIALS,
    ACCOUNT_DISABLED,
    UNAUTHENTICATED,
    TOKEN_EXPIRED,
    INVALID_TOKEN,
    ACCESS_DENIED,
    FORBIDDEN_ACTION,

    // Solicitud mal formada
    VALIDATION_FAILED,
    MALFORMED_REQUEST,
    INVALID_PARAMETER,
    MISSING_PARAMETER,
    INVALID_ARGUMENT,
    METHOD_NOT_ALLOWED,
    UNSUPPORTED_MEDIA_TYPE,

    // Recursos y reglas de negocio
    RESOURCE_NOT_FOUND,
    ROUTE_NOT_FOUND,
    DUPLICATE_SKU,
    DATA_INTEGRITY,
    CONCURRENT_MODIFICATION,
    INVALID_STATE,
    ALREADY_RESOLVED,
    INSUFFICIENT_STOCK,
    EMPTY_SALE,
    INVALID_RETURN_OPERATION,

    // Fallos del servidor
    INTERNAL_ERROR
}
