package co.com.zenvory.inventario.shared.infrastructure.web;

import co.com.zenvory.inventario.auth.domain.exception.AccountDisabledException;
import co.com.zenvory.inventario.auth.domain.exception.InvalidCredentialsException;
import co.com.zenvory.inventario.auth.domain.exception.UserNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import co.com.zenvory.inventario.branch.domain.exception.BranchNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.DuplicateSkuException;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException;
import co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException;
import co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException;
import co.com.zenvory.inventario.inventory.domain.exception.InventoryNotFoundException;
import co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException;
import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;
import co.com.zenvory.inventario.sale.domain.exception.EmptySaleException;
import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * Manejador global de excepciones para toda la API.
 * Traduce excepciones de dominio al protocolo HTTP con formato uniforme (ErrorResponse).
 *
 * <p>Los handlers más específicos tienen prioridad sobre el fallback genérico.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 404 – Sucursal no encontrada. */
    @ExceptionHandler(BranchNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleBranchNotFound(BranchNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 404 – Usuario no encontrado. */
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFound(UserNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 401 – Credenciales incorrectas (email o contraseña inválidos). */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(ex.getMessage()));
    }

    /** 401 – Cuenta desactivada. */
    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<ErrorResponse> handleAccountDisabled(AccountDisabledException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(ex.getMessage()));
    }

    /** 404 – Producto no encontrado. */
    @ExceptionHandler(ProductNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleProductNotFound(ProductNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 404 – Proveedor no encontrado. */
    @ExceptionHandler(SupplierNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSupplierNotFound(SupplierNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 404 – Unidad de medida no encontrada. */
    @ExceptionHandler(UnitOfMeasureNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUnitNotFound(UnitOfMeasureNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 409 – SKU de producto duplicado. */
    @ExceptionHandler(DuplicateSkuException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateSku(DuplicateSkuException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    /** 422 - Stock Insuficiente en el Inventario. */
    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientStock(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new ErrorResponse(ex.getMessage()));
    }

    /** 404 - Registro de Inventario Local no encontrado. */
    @ExceptionHandler(InventoryNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleInventoryNotFound(InventoryNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(ex.getMessage()));
    }

    /** 422 - Venta sin elementos. */
    @ExceptionHandler(EmptySaleException.class)
    public ResponseEntity<ErrorResponse> handleEmptySale(EmptySaleException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new ErrorResponse(ex.getMessage()));
    }

    /** 409 - Estado de Transferencia Inválido. */
    @ExceptionHandler(InvalidTransferStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTransferState(InvalidTransferStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    /** 409 - Estado de Orden de Compra Inválido. */
    @ExceptionHandler(InvalidPurchaseStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPurchaseState(InvalidPurchaseStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    /** 409 - Alerta ya Resuelta. */
    @ExceptionHandler(AlertAlreadyResolvedException.class)
    public ResponseEntity<ErrorResponse> handleAlertAlreadyResolved(AlertAlreadyResolvedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(ex.getMessage()));
    }

    /** 400 - Parámetro ilegal genérico (común en constructores del dominio). */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(ex.getMessage()));
    }

    /** 400 – Fallo de validación Bean Validation (@Valid). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorResponse(message));
    }

    /** 500 – Fallback para excepciones no manejadas explícitamente. */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLocking(ObjectOptimisticLockingFailureException ex) {
        log.warn("Optimistic locking failure: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("El documento fue modificado por otro usuario. Por favor, recarga la página e intenta de nuevo."));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleGeneral(RuntimeException ex) {
        log.error("Internal Server Error: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse(ex.getMessage()));
    }
}
