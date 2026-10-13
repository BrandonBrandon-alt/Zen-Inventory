package co.com.zenvory.inventario.shared.infrastructure.web;

import co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException;
import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.exception.UserNotFoundException;
import co.com.zenvory.inventario.branch.domain.exception.BranchNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.DuplicateSkuException;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException;
import co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException;
import co.com.zenvory.inventario.inventory.domain.exception.InventoryNotFoundException;
import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;
import co.com.zenvory.inventario.sale.domain.exception.EmptySaleException;
import co.com.zenvory.inventario.sale.domain.exception.InvalidReturnOperationException;
import co.com.zenvory.inventario.sale.domain.exception.ReturnRequestNotFoundException;
import co.com.zenvory.inventario.sale.domain.exception.SaleNotFoundException;
import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Manejador global de excepciones para toda la API.
 * Traduce excepciones al protocolo HTTP con el formato uniforme {@link ErrorResponse}:
 * status + código estable ({@link ErrorCode}) + mensaje legible + ruta + traceId.
 *
 * <p>Regla de seguridad: el mensaje de una excepción inesperada NUNCA llega al cliente. Solo las excepciones
 * de dominio conocidas (tabla {@link #DOMAIN}) exponen su mensaje, porque están escritas para el usuario.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private record Mapping(HttpStatus status, ErrorCode code) {}

    /** Excepciones de dominio: su mensaje es apto para el usuario y se devuelve tal cual. */
    private static final Map<Class<? extends RuntimeException>, Mapping> DOMAIN = Map.ofEntries(
            Map.entry(InvalidCredentialsException.class, new Mapping(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS)),
            Map.entry(AccountDisabledException.class, new Mapping(HttpStatus.UNAUTHORIZED, ErrorCode.ACCOUNT_DISABLED)),
            Map.entry(UnauthorizedActionException.class, new Mapping(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN_ACTION)),
            Map.entry(UserNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(BranchNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(ProductNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(SupplierNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(UnitOfMeasureNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(InventoryNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(SaleNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(ReturnRequestNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(DuplicateSkuException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_SKU)),
            Map.entry(InvalidTransferStateException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE)),
            Map.entry(InvalidPurchaseStateException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE)),
            Map.entry(AlertAlreadyResolvedException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.ALREADY_RESOLVED)),
            Map.entry(InsufficientStockException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INSUFFICIENT_STOCK)),
            Map.entry(EmptySaleException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.EMPTY_SALE)),
            Map.entry(InvalidReturnOperationException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INVALID_RETURN_OPERATION)),
            // Común en constructores del dominio (validaciones de invariantes).
            Map.entry(IllegalArgumentException.class, new Mapping(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_ARGUMENT))
    );

    /** Excepciones de dominio conocidas; cualquier otra RuntimeException se trata como error inesperado. */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex, HttpServletRequest request) {
        Mapping mapping = mappingFor(ex);
        if (mapping != null) {
            return respond(mapping.status(), mapping.code(), ex.getMessage(), request);
        }
        return unexpected(ex, request);
    }

    /** 400 – Fallo de validación Bean Validation (@Valid), con errores por campo. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new ErrorResponse.FieldError(e.getField(), e.getDefaultMessage()))
                .toList();
        // `message` conserva el resumen en una sola cadena para los clientes que aún no usan fieldErrors.
        String message = fieldErrors.stream()
                .map(e -> e.field() + ": " + e.message())
                .collect(Collectors.joining(", "));
        ErrorResponse body = ErrorResponse.of(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                message, request.getRequestURI(), ErrorResponse.newTraceId(), fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /** 400 – Cuerpo ilegible (JSON mal formado, tipos incorrectos). No se expone el detalle de Jackson. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMalformedBody(HttpMessageNotReadableException ex, HttpServletRequest request) {
        log.debug("Cuerpo de solicitud ilegible: {}", ex.getMessage());
        return respond(HttpStatus.BAD_REQUEST, ErrorCode.MALFORMED_REQUEST,
                "El cuerpo de la solicitud no es válido.", request);
    }

    /** 400 – Parámetro de ruta o consulta con tipo incorrecto. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        return respond(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_PARAMETER,
                "El valor del parámetro '" + ex.getName() + "' no es válido.", request);
    }

    /** 400 – Falta un parámetro obligatorio. */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex, HttpServletRequest request) {
        return respond(HttpStatus.BAD_REQUEST, ErrorCode.MISSING_PARAMETER,
                "Falta el parámetro obligatorio '" + ex.getParameterName() + "'.", request);
    }

    /** 405 – Método HTTP no permitido en la ruta. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return respond(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED,
                "El método " + ex.getMethod() + " no está permitido para esta ruta.", request);
    }

    /** 415 – Tipo de contenido no soportado. */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        return respond(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE,
                "El tipo de contenido de la solicitud no está soportado.", request);
    }

    /** 404 – Ruta inexistente. */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponse> handleRouteNotFound(Exception ex, HttpServletRequest request) {
        return respond(HttpStatus.NOT_FOUND, ErrorCode.ROUTE_NOT_FOUND, "El recurso solicitado no existe.", request);
    }

    /** 403 – Falta de roles (seguridad por método). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return respond(HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED,
                "No tienes permisos para realizar esta acción.", request);
    }

    /** 409 – Conflicto de integridad de datos (ej: SKU duplicado a nivel DB). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex, HttpServletRequest request) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        String detail = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
        if (detail.contains("producto_sku_key") || detail.contains("sku")) {
            return respond(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_SKU, "Ya existe un producto con el SKU indicado.", request);
        }
        return respond(HttpStatus.CONFLICT, ErrorCode.DATA_INTEGRITY,
                "No se pudo realizar la operación porque viola una restricción de integridad (posible duplicado).", request);
    }

    /** 409 – Otro usuario modificó el mismo registro. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLocking(ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        log.warn("Optimistic locking failure: {}", ex.getMessage());
        return respond(HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION,
                "El documento fue modificado por otro usuario. Por favor, recarga la página e intenta de nuevo.", request);
    }

    /** 500 – Cualquier otra excepción (no RuntimeException): mensaje genérico. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAnyException(Exception ex, HttpServletRequest request) {
        return unexpected(ex, request);
    }

    // ------------------------------------------------------------------ helpers

    private static Mapping mappingFor(RuntimeException ex) {
        for (Class<?> type = ex.getClass(); type != null && type != Object.class; type = type.getSuperclass()) {
            Mapping mapping = DOMAIN.get(type);
            if (mapping != null) return mapping;
        }
        return null;
    }

    private ResponseEntity<ErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
        String traceId = ErrorResponse.newTraceId();
        log.error("[{}] Error inesperado en {} {}", traceId, request.getMethod(), request.getRequestURI(), ex);
        String message = "Ocurrió un error inesperado. Si el problema continúa, comunica este código al administrador: " + traceId;
        ErrorResponse body = ErrorResponse.of(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR,
                message, request.getRequestURI(), traceId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private ResponseEntity<ErrorResponse> respond(HttpStatus status, ErrorCode code, String message, HttpServletRequest request) {
        ErrorResponse body = ErrorResponse.of(status, code, message, request.getRequestURI(), ErrorResponse.newTraceId());
        return ResponseEntity.status(status).body(body);
    }
}
