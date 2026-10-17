package co.com.zenvory.inventario.shared.infrastructure.web;

import co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException;
import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.exception.DuplicateEmailException;
import co.com.zenvory.inventario.auth.domain.exception.RoleNotFoundException;
import co.com.zenvory.inventario.auth.domain.exception.TooManyLoginAttemptsException;
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
import co.com.zenvory.inventario.sale.domain.exception.InvalidSaleStateException;
import co.com.zenvory.inventario.sale.domain.exception.ReturnRequestNotFoundException;
import co.com.zenvory.inventario.sale.domain.exception.SaleNotFoundException;
import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.beans.TypeMismatchException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.OptimisticLockingFailureException;
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
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private record Mapping(HttpStatus status, ErrorCode code) {}

    /** Excepciones de dominio: su mensaje es apto para el usuario y se devuelve tal cual. */
    private static final Map<Class<? extends RuntimeException>, Mapping> DOMAIN = Map.ofEntries(
            Map.entry(InvalidCredentialsException.class, new Mapping(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS)),
            Map.entry(AccountDisabledException.class, new Mapping(HttpStatus.UNAUTHORIZED, ErrorCode.ACCOUNT_DISABLED)),
            Map.entry(UnauthorizedActionException.class, new Mapping(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN_ACTION)),
            Map.entry(TooManyLoginAttemptsException.class, new Mapping(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS)),
            Map.entry(DuplicateEmailException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.DATA_INTEGRITY)),
            Map.entry(RoleNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(UserNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(BranchNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(ProductNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(SupplierNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(UnitOfMeasureNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(InventoryNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(SaleNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(ReturnRequestNotFoundException.class, new Mapping(HttpStatus.NOT_FOUND, ErrorCode.RESOURCE_NOT_FOUND)),
            Map.entry(DuplicateSkuException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_SKU)),
            Map.entry(InvalidSaleStateException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE)),
            Map.entry(InvalidTransferStateException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE)),
            Map.entry(InvalidPurchaseStateException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.INVALID_STATE)),
            Map.entry(AlertAlreadyResolvedException.class, new Mapping(HttpStatus.CONFLICT, ErrorCode.ALREADY_RESOLVED)),
            Map.entry(InsufficientStockException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INSUFFICIENT_STOCK)),
            Map.entry(EmptySaleException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.EMPTY_SALE)),
            Map.entry(InvalidReturnOperationException.class, new Mapping(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.INVALID_RETURN_OPERATION)),
            // Común en constructores del dominio (validaciones de invariantes).
            Map.entry(IllegalArgumentException.class, new Mapping(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_ARGUMENT))
    );

    /** Paquete base de la aplicación: una excepción lanzada desde aquí tiene un mensaje escrito para el usuario. */
    private static final String APP_PACKAGE = "co.com.zenvory";

    /** Excepciones de dominio conocidas; cualquier otra RuntimeException se trata como error inesperado. */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex, HttpServletRequest request) {
        Mapping mapping = mappingFor(ex);
        if (mapping != null) {
            return respond(mapping.status(), mapping.code(), safeMessage(ex, mapping, request), request);
        }
        return unexpected(ex, request);
    }

    /**
     * El mensaje de una excepción de dominio es apto para el usuario; el de una {@link IllegalArgumentException}
     * lanzada por una librería (Hibernate, Jackson, JDK…) no: puede traer nombres de clases, entidades o SQL.
     * Se distingue por quién la lanzó.
     */
    private String safeMessage(RuntimeException ex, Mapping mapping, HttpServletRequest request) {
        if (ex instanceof IllegalArgumentException && !thrownByApplication(ex)) {
            String traceId = ErrorResponse.newTraceId();
            log.warn("[{}] IllegalArgumentException de librería en {} {}: {}", traceId, request.getMethod(), request.getRequestURI(), ex.toString());
            return "La solicitud contiene un valor que no es válido. Código: " + traceId;
        }
        return ex.getMessage();
    }

    private static boolean thrownByApplication(Throwable ex) {
        StackTraceElement[] trace = ex.getStackTrace();
        return trace.length > 0 && trace[0].getClassName().startsWith(APP_PACKAGE);
    }

    // ------------------------------------------------- excepciones estándar de Spring MVC
    // Se extiende ResponseEntityExceptionHandler para que TODA excepción de MVC conserve su estado HTTP (4xx) y no
    // caiga en el 500 genérico; aquí solo se reemplaza el cuerpo por el contrato uniforme de la API.

    /** 400 – Fallo de validación Bean Validation (@Valid), con errores por campo (y los de nivel de clase). */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = new java.util.ArrayList<>();
        for (ObjectError error : ex.getBindingResult().getAllErrors()) {
            // Los errores de nivel de clase (@AssertTrue, validadores cruzados) no tienen campo: se nombran por el objeto.
            String field = error instanceof FieldError fe ? fe.getField() : error.getObjectName();
            fieldErrors.add(new ErrorResponse.FieldError(field, error.getDefaultMessage()));
        }
        return validationFailed(fieldErrors, request);
    }

    /** 400 – Validación de parámetros de método (@Validated sobre @RequestParam/@PathVariable, Spring 6.1+). */
    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex, HttpHeaders headers,
                                                                            HttpStatusCode status, WebRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = new java.util.ArrayList<>();
        ex.getParameterValidationResults().forEach(result -> result.getResolvableErrors().forEach(error ->
                fieldErrors.add(new ErrorResponse.FieldError(
                        result.getMethodParameter().getParameterName() != null ? result.getMethodParameter().getParameterName() : "parametro",
                        error.getDefaultMessage()))));
        return validationFailed(fieldErrors, request);
    }

    /** 400 – Restricciones de Bean Validation sobre parámetros (@Validated en la clase). */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        List<ErrorResponse.FieldError> fieldErrors = ex.getConstraintViolations().stream()
                .map(this::toFieldError)
                .toList();
        return ResponseEntity.badRequest().body(validationBody(fieldErrors, request.getRequestURI()));
    }

    private ErrorResponse.FieldError toFieldError(ConstraintViolation<?> violation) {
        String path = violation.getPropertyPath().toString();
        return new ErrorResponse.FieldError(path.substring(path.lastIndexOf('.') + 1), violation.getMessage());
    }

    /** 400 – Cuerpo ilegible (JSON mal formado, tipos incorrectos). No se expone el detalle de Jackson. */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        log.debug("Cuerpo de solicitud ilegible: {}", ex.getMessage());
        return body(HttpStatus.BAD_REQUEST, ErrorCode.MALFORMED_REQUEST, "El cuerpo de la solicitud no es válido.", request);
    }

    /** 400 – Parámetro de ruta o consulta con tipo incorrecto. */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
                                                        HttpStatusCode status, WebRequest request) {
        String name = ex instanceof MethodArgumentTypeMismatchException m ? m.getName() : ex.getPropertyName();
        return body(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_PARAMETER,
                "El valor del parámetro '" + name + "' no es válido.", request);
    }

    /** 400 – Falta un parámetro obligatorio. */
    @Override
    protected ResponseEntity<Object> handleMissingServletRequestParameter(MissingServletRequestParameterException ex, HttpHeaders headers,
                                                                          HttpStatusCode status, WebRequest request) {
        return body(HttpStatus.BAD_REQUEST, ErrorCode.MISSING_PARAMETER,
                "Falta el parámetro obligatorio '" + ex.getParameterName() + "'.", request);
    }

    /** 405 – Método HTTP no permitido en la ruta. */
    @Override
    protected ResponseEntity<Object> handleHttpRequestMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpHeaders headers,
                                                                         HttpStatusCode status, WebRequest request) {
        return body(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED,
                "El método " + ex.getMethod() + " no está permitido para esta ruta.", request);
    }

    /** 415 – Tipo de contenido no soportado. */
    @Override
    protected ResponseEntity<Object> handleHttpMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex, HttpHeaders headers,
                                                                     HttpStatusCode status, WebRequest request) {
        return body(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UNSUPPORTED_MEDIA_TYPE,
                "El tipo de contenido de la solicitud no está soportado.", request);
    }

    /** 404 – Ruta inexistente. */
    @Override
    protected ResponseEntity<Object> handleNoResourceFoundException(NoResourceFoundException ex, HttpHeaders headers,
                                                                    HttpStatusCode status, WebRequest request) {
        return body(HttpStatus.NOT_FOUND, ErrorCode.ROUTE_NOT_FOUND, "El recurso solicitado no existe.", request);
    }

    @Override
    protected ResponseEntity<Object> handleNoHandlerFoundException(NoHandlerFoundException ex, HttpHeaders headers,
                                                                   HttpStatusCode status, WebRequest request) {
        return body(HttpStatus.NOT_FOUND, ErrorCode.ROUTE_NOT_FOUND, "El recurso solicitado no existe.", request);
    }

    /**
     * Resto de excepciones estándar de MVC (cabecera o variable de ruta ausente, {@code Accept} no soportado,
     * {@code ResponseStatusException}…): conservan su estado HTTP y se responden con el contrato uniforme, sin
     * exponer el mensaje interno.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object ignored, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        HttpStatus status = HttpStatus.resolve(statusCode.value()) != null ? HttpStatus.valueOf(statusCode.value()) : HttpStatus.BAD_REQUEST;
        if (status.is5xxServerError()) {
            return unexpectedBody(ex, request);
        }
        ErrorCode code = switch (status) {
            case NOT_FOUND -> ErrorCode.RESOURCE_NOT_FOUND;
            case NOT_ACCEPTABLE -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            case FORBIDDEN -> ErrorCode.ACCESS_DENIED;
            case CONFLICT -> ErrorCode.INVALID_STATE;
            default -> ErrorCode.INVALID_PARAMETER;
        };
        String message = switch (status) {
            case NOT_FOUND -> "El recurso solicitado no existe.";
            case NOT_ACCEPTABLE -> "No es posible responder en el formato solicitado.";
            case FORBIDDEN -> "No tienes permisos para realizar esta acción.";
            case CONFLICT -> "La operación entra en conflicto con el estado actual de los datos.";
            default -> "La solicitud no es válida.";
        };
        return body(status, code, message, request);
    }

    /** 403 – Falta de roles (seguridad por método). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return respond(HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED,
                "No tienes permisos para realizar esta acción.", request);
    }

    // ------------------------------------------------------------- datos y concurrencia

    /** 409 – Conflicto de integridad de datos (ej: SKU duplicado a nivel DB). */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex, HttpServletRequest request) {
        // Se registra solo el nombre de la restricción: el mensaje del driver trae SQL y valores de las filas.
        String constraint = constraintName(ex);
        log.warn("Violación de integridad en {} {} (restricción: {})", request.getMethod(), request.getRequestURI(), constraint);
        if (constraint != null && constraint.toLowerCase(java.util.Locale.ROOT).contains("sku")) {
            return respond(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_SKU, "Ya existe un producto con el SKU indicado.", request);
        }
        return respond(HttpStatus.CONFLICT, ErrorCode.DATA_INTEGRITY,
                "No se pudo realizar la operación porque viola una restricción de integridad (posible duplicado).", request);
    }

    private static String constraintName(Throwable ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof org.hibernate.exception.ConstraintViolationException violation) {
                return violation.getConstraintName();
            }
        }
        return null;
    }

    /** 409 – Otro usuario modificó el mismo registro. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLocking(OptimisticLockingFailureException ex, HttpServletRequest request) {
        log.warn("Optimistic locking failure: {}", ex.getMessage());
        return respond(HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION,
                "El documento fue modificado por otro usuario. Por favor, recarga la página e intenta de nuevo.", request);
    }

    /**
     * 409 – Otra operación tenía bloqueados los mismos datos (tiempo de espera agotado, interbloqueo). Es
     * reintentable: el inventario usa bloqueo de filas, así que esto ocurre bajo carga y no es un fallo del servidor.
     */
    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handlePessimisticLocking(PessimisticLockingFailureException ex, HttpServletRequest request) {
        log.warn("Bloqueo de datos no obtenido en {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getClass().getSimpleName());
        return respond(HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION,
                "Otra operación está usando estos datos en este momento. Inténtalo de nuevo en unos segundos.", request);
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

    private static String path(WebRequest request) {
        return request instanceof ServletWebRequest web ? web.getRequest().getRequestURI() : "";
    }

    private ResponseEntity<Object> body(HttpStatus status, ErrorCode code, String message, WebRequest request) {
        return ResponseEntity.status(status).body(ErrorResponse.of(status, code, message, path(request), ErrorResponse.newTraceId()));
    }

    private ResponseEntity<Object> validationFailed(List<ErrorResponse.FieldError> fieldErrors, WebRequest request) {
        return ResponseEntity.badRequest().body(validationBody(fieldErrors, path(request)));
    }

    private ErrorResponse validationBody(List<ErrorResponse.FieldError> fieldErrors, String path) {
        // `message` conserva el resumen en una sola cadena para los clientes que aún no usan fieldErrors.
        String message = fieldErrors.isEmpty()
                ? "La solicitud no es válida."
                : fieldErrors.stream().map(e -> e.field() + ": " + e.message()).collect(Collectors.joining(", "));
        return ErrorResponse.of(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message, path, ErrorResponse.newTraceId(), fieldErrors);
    }

    private ResponseEntity<Object> unexpectedBody(Exception ex, WebRequest request) {
        String traceId = ErrorResponse.newTraceId();
        log.error("[{}] Error inesperado en {}", traceId, path(request), ex);
        String message = "Ocurrió un error inesperado. Si el problema continúa, comunica este código al administrador: " + traceId;
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, message, path(request), traceId));
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
