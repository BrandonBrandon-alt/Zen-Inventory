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
import co.com.zenvory.inventario.sale.domain.exception.ReturnRequestNotFoundException;
import co.com.zenvory.inventario.sale.domain.exception.SaleNotFoundException;
import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("GlobalExceptionHandler — contrato de errores")
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    static Stream<Arguments> domainErrors() {
        return Stream.of(
                Arguments.of("invalid-credentials", 401, "INVALID_CREDENTIALS", "Credenciales incorrectas"),
                Arguments.of("account-disabled", 401, "ACCOUNT_DISABLED", null),
                Arguments.of("unauthorized-action", 403, "FORBIDDEN_ACTION", "Sede no permitida"),
                Arguments.of("role-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("too-many-attempts", 429, "TOO_MANY_REQUESTS", null),
                Arguments.of("duplicate-email", 409, "DATA_INTEGRITY", "Ya existe un usuario con ese correo."),
                Arguments.of("user-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("branch-not-found", 404, "RESOURCE_NOT_FOUND", "Sucursal no encontrada con ID: 7"),
                Arguments.of("product-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("supplier-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("unit-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("inventory-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("sale-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("return-not-found", 404, "RESOURCE_NOT_FOUND", null),
                Arguments.of("duplicate-sku", 409, "DUPLICATE_SKU", null),
                Arguments.of("invalid-transfer-state", 409, "INVALID_STATE", "Transferencia ya despachada"),
                Arguments.of("invalid-purchase-state", 409, "INVALID_STATE", null),
                Arguments.of("alert-resolved", 409, "ALREADY_RESOLVED", null),
                Arguments.of("insufficient-stock", 422, "INSUFFICIENT_STOCK", null),
                Arguments.of("empty-sale", 422, "EMPTY_SALE", null),
                Arguments.of("invalid-return", 422, "INVALID_RETURN_OPERATION", null),
                Arguments.of("illegal-argument", 400, "INVALID_ARGUMENT", "Cantidad inválida"));
    }

    @ParameterizedTest(name = "{0} -> {1} {2}")
    @MethodSource("domainErrors")
    @DisplayName("Las excepciones de dominio se traducen a status + código estable + mensaje")
    void domainExceptions(String kind, int httpStatus, String code, String message) throws Exception {
        var result = mockMvc.perform(get("/t/domain/" + kind))
                .andExpect(status().is(httpStatus))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(httpStatus))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.path").value("/t/domain/" + kind))
                .andExpect(jsonPath("$.traceId", matchesPattern("[a-f0-9]{8}")))
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.message").isNotEmpty());
        if (message != null) {
            result.andExpect(jsonPath("$.message").value(message));
        }
    }

    @Test
    @DisplayName("Validación @Valid: 400 VALIDATION_FAILED con errores por campo y el mensaje resumido de siempre")
    void validationErrors() throws Exception {
        mockMvc.perform(post("/t/validate").contentType(MediaType.APPLICATION_JSON).content("{\"nombre\":\"\",\"direccion\":\"ab\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='nombre')].message").value("El nombre es obligatorio"))
                .andExpect(jsonPath("$.fieldErrors[?(@.field=='direccion')].message").value("Mínimo 3 caracteres"))
                // Compatibilidad con el frontend Next: `message` sigue siendo una sola cadena legible.
                .andExpect(jsonPath("$.message", containsString("nombre: El nombre es obligatorio")));
    }

    @Test
    @DisplayName("Los errores que no son de validación no incluyen fieldErrors")
    void noFieldErrorsOutsideValidation() throws Exception {
        mockMvc.perform(get("/t/domain/invalid-credentials"))
                .andExpect(jsonPath("$.fieldErrors").doesNotExist());
    }

    @Test
    @DisplayName("JSON mal formado: 400 MALFORMED_REQUEST sin detalles de Jackson")
    void malformedJson() throws Exception {
        mockMvc.perform(post("/t/validate").contentType(MediaType.APPLICATION_JSON).content("{\"nombre\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"))
                .andExpect(jsonPath("$.message", not(containsString("Unexpected"))))
                .andExpect(jsonPath("$.message", not(containsString("JSON parse"))));
    }

    @Test
    @DisplayName("Parámetro de ruta con tipo incorrecto: 400 INVALID_PARAMETER sin nombres de clases Java")
    void typeMismatch() throws Exception {
        mockMvc.perform(get("/t/typed/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
                .andExpect(jsonPath("$.message", not(containsString("java.lang"))))
                .andExpect(jsonPath("$.message", containsString("id")));
    }

    @Test
    @DisplayName("Falta un parámetro obligatorio: 400 MISSING_PARAMETER")
    void missingParameter() throws Exception {
        mockMvc.perform(get("/t/param"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_PARAMETER"))
                .andExpect(jsonPath("$.message", containsString("q")));
    }

    @Test
    @DisplayName("Método no soportado: 405 METHOD_NOT_ALLOWED")
    void methodNotAllowed() throws Exception {
        mockMvc.perform(put("/t/typed/1"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    @DisplayName("Tipo de contenido no soportado: 415 UNSUPPORTED_MEDIA_TYPE")
    void unsupportedMediaType() throws Exception {
        mockMvc.perform(post("/t/validate").contentType(MediaType.TEXT_PLAIN).content("hola"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    @DisplayName("Ruta inexistente: 404 ROUTE_NOT_FOUND")
    void unknownRoute() throws Exception {
        mockMvc.perform(get("/t/no-existe"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ROUTE_NOT_FOUND"))
                .andExpect(jsonPath("$.path").value("/t/no-existe"));
    }

    @Test
    @DisplayName("AccessDenied: 403 ACCESS_DENIED")
    void accessDenied() throws Exception {
        mockMvc.perform(get("/t/denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.message").value("No tienes permisos para realizar esta acción."));
    }

    @Test
    @DisplayName("Violación de integridad por SKU: 409 DUPLICATE_SKU; otras: 409 DATA_INTEGRITY")
    void dataIntegrity() throws Exception {
        mockMvc.perform(get("/t/integrity/sku"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_SKU"))
                .andExpect(jsonPath("$.message").value("Ya existe un producto con el SKU indicado."));
        mockMvc.perform(get("/t/integrity/other"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DATA_INTEGRITY"))
                .andExpect(jsonPath("$.message", not(containsString("constraint"))));
    }

    @Test
    @DisplayName("Un mensaje que menciona 'sku' pero de otra restricción NO es SKU duplicado")
    void messageMentioningSkuIsNotDuplicateSku() throws Exception {
        mockMvc.perform(get("/t/integrity/message-only-sku"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DATA_INTEGRITY"));
    }

    @Test
    @DisplayName("Bloqueo de filas no obtenido o interbloqueo: 409 reintentable, no 500")
    void pessimisticLocking() throws Exception {
        for (String kind : new String[] {"timeout", "deadlock"}) {
            mockMvc.perform(get("/t/pessimistic/" + kind))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("CONCURRENT_MODIFICATION"))
                    .andExpect(jsonPath("$.message", containsString("Inténtalo de nuevo")));
        }
    }

    @Test
    @DisplayName("Errores 4xx del framework conservan su estado y el contrato: cabecera ausente, ResponseStatusException, Accept no soportado")
    void frameworkClientErrorsStayClientErrors() throws Exception {
        mockMvc.perform(get("/t/header"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
        mockMvc.perform(get("/t/status"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message", not(containsString("detalle interno"))));
        // Con Accept: application/xml no se puede serializar el cuerpo JSON, pero el estado correcto (406, no 500) se conserva.
        mockMvc.perform(get("/t/json").accept("application/xml"))
                .andExpect(status().isNotAcceptable());
    }

    @Test
    @DisplayName("Restricciones sobre parámetros (@Min): 400 VALIDATION_FAILED con el campo")
    void parameterConstraints() throws Exception {
        mockMvc.perform(get("/t/min?n=0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Debe ser al menos 1"));
    }

    @Test
    @DisplayName("Una IllegalArgumentException de una librería no filtra su mensaje interno")
    void libraryIllegalArgumentDoesNotLeak() throws Exception {
        mockMvc.perform(get("/t/enum"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"))
                .andExpect(jsonPath("$.message", not(containsString("No enum constant"))))
                .andExpect(jsonPath("$.message", not(containsString("Thread"))));
    }

    @Test
    @DisplayName("Errores de validación de nivel de clase aparecen en fieldErrors")
    void classLevelValidationErrors() throws Exception {
        mockMvc.perform(post("/t/cross").contentType("application/json").content("{\"from\": 5, \"to\": 1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("El rango no es válido"));
    }

    @Test
    @DisplayName("Bloqueo optimista: 409 CONCURRENT_MODIFICATION")
    void optimisticLock() throws Exception {
        mockMvc.perform(get("/t/lock"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONCURRENT_MODIFICATION"));
    }

    @Test
    @DisplayName("Error inesperado: 500 INTERNAL_ERROR genérico, sin filtrar el mensaje interno, con traceId")
    void unexpectedErrorsNeverLeakInternals() throws Exception {
        mockMvc.perform(get("/t/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message", not(containsString("secreto"))))
                .andExpect(jsonPath("$.message", not(containsString("jdbc"))))
                .andExpect(jsonPath("$.traceId", matchesPattern("[a-f0-9]{8}")));
    }

    @Test
    @DisplayName("El mensaje del 500 incluye el traceId para que el usuario pueda reportarlo")
    void internalErrorMessageMentionsTraceId() throws Exception {
        String body = mockMvc.perform(get("/t/boom")).andReturn().getResponse().getContentAsString();
        String traceId = com.jayway.jsonpath.JsonPath.read(body, "$.traceId");
        String message = com.jayway.jsonpath.JsonPath.read(body, "$.message");
        org.junit.jupiter.api.Assertions.assertTrue(message.contains(traceId), "el mensaje debe mencionar el traceId");
    }

    @RestController
    @RequestMapping("/t")
    static class ProbeController {

        record Cross(int from, int to) {
            @jakarta.validation.constraints.AssertTrue(message = "El rango no es válido")
            boolean isRange() { return from <= to; }
        }

        record Body(
                @NotBlank(message = "El nombre es obligatorio") String nombre,
                @Size(min = 3, message = "Mínimo 3 caracteres") String direccion) {}

        @GetMapping("/domain/{kind}")
        void domain(@PathVariable String kind) {
            throw switch (kind) {
                case "invalid-credentials" -> new InvalidCredentialsException();
                case "account-disabled" -> new AccountDisabledException();
                case "unauthorized-action" -> new UnauthorizedActionException("Sede no permitida");
                case "role-not-found" -> new RoleNotFoundException(9L);
                case "too-many-attempts" -> new TooManyLoginAttemptsException();
                case "duplicate-email" -> new DuplicateEmailException();
                case "user-not-found" -> new UserNotFoundException(3L);
                case "branch-not-found" -> new BranchNotFoundException(7L);
                case "product-not-found" -> new ProductNotFoundException(1L);
                case "supplier-not-found" -> new SupplierNotFoundException(1L);
                case "unit-not-found" -> new UnitOfMeasureNotFoundException(1L);
                case "inventory-not-found" -> new InventoryNotFoundException(1L, 2L);
                case "sale-not-found" -> new SaleNotFoundException(1L);
                case "return-not-found" -> new ReturnRequestNotFoundException(1L);
                case "duplicate-sku" -> new DuplicateSkuException("ABC-1");
                case "invalid-transfer-state" -> new InvalidTransferStateException("Transferencia ya despachada");
                case "invalid-purchase-state" -> new InvalidPurchaseStateException("Orden ya recibida");
                case "alert-resolved" -> new AlertAlreadyResolvedException("La alerta ya fue resuelta");
                case "insufficient-stock" -> new InsufficientStockException("Tornillo", BigDecimal.TEN, BigDecimal.ONE);
                case "empty-sale" -> new EmptySaleException("La venta no tiene ítems");
                case "invalid-return" -> new InvalidReturnOperationException("Devolución no permitida");
                case "illegal-argument" -> new IllegalArgumentException("Cantidad inválida");
                default -> new IllegalStateException("tipo desconocido");
            };
        }

        @PostMapping("/validate")
        void validate(@Valid @RequestBody Body body) {}

        @GetMapping("/typed/{id}")
        void typed(@PathVariable Long id) {}

        @GetMapping("/param")
        void param(@RequestParam String q) {}

        @GetMapping("/denied")
        void denied() {
            throw new AccessDeniedException("detalle interno");
        }

        @GetMapping("/integrity/{kind}")
        void integrity(@PathVariable String kind) {
            // El tipo de violación se decide por el nombre real de la restricción, no por el texto del mensaje.
            String constraint = kind.equals("sku") ? "producto_sku_key" : "detalle_fk";
            String detail = kind.equals("message-only-sku")
                    ? "ERROR: null value in column \"sku_ref\" violates not-null constraint"
                    : "ERROR: violates constraint " + constraint;
            throw new DataIntegrityViolationException(detail, new org.hibernate.exception.ConstraintViolationException(
                    detail, new java.sql.SQLException(detail), kind.equals("message-only-sku") ? "detalle_nn" : constraint));
        }

        @GetMapping("/pessimistic/{kind}")
        void pessimistic(@PathVariable String kind) {
            throw kind.equals("deadlock")
                    ? new org.springframework.dao.DeadlockLoserDataAccessException("deadlock", null)
                    : new org.springframework.dao.CannotAcquireLockException("lock timeout");
        }

        @GetMapping("/header")
        void header(@org.springframework.web.bind.annotation.RequestHeader("X-Tenant") String tenant) {}

        @GetMapping("/status")
        void status() {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "detalle interno de ruta");
        }

        @GetMapping(value = "/json", produces = "application/json")
        String json() { return "{}"; }

        @GetMapping("/min")
        void min(@RequestParam @jakarta.validation.constraints.Min(value = 1, message = "Debe ser al menos 1") int n) {}

        @GetMapping("/enum")
        void enumValue() {
            Thread.State.valueOf("NOPE");
        }

        @PostMapping("/cross")
        void cross(@Valid @RequestBody Cross body) {}

        @GetMapping("/lock")
        void lock() {
            throw new ObjectOptimisticLockingFailureException(Object.class, 1L);
        }

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException("detalle interno secreto: jdbc:postgresql://db:5432/zen");
        }
    }
}
