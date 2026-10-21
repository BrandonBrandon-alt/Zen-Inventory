package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.transfer.domain.model.TransferPaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Pago o abono del flete de un traslado. Sin {@code amount} se paga todo el saldo pendiente. */
public record FreightPaymentRequest(
        @DecimalMin(value = "0.01", message = "El monto debe ser mayor que cero")
        @Digits(integer = 10, fraction = 2, message = "El monto admite hasta 2 decimales")
        BigDecimal amount,
        TransferPaymentMethod method,
        @Size(max = 100, message = "La referencia admite hasta 100 caracteres")
        String reference,
        @Size(max = 500, message = "Las notas admiten hasta 500 caracteres")
        String notes
) {}
