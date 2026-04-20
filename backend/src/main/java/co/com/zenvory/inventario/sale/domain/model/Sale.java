package co.com.zenvory.inventario.sale.domain.model;

import co.com.zenvory.inventario.sale.domain.exception.EmptySaleException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

public class Sale {
    private Long id;
    private LocalDateTime date;
    private BigDecimal subtotal;
    private BigDecimal totalDiscount;
    private BigDecimal totalFinal;
    private Long branchId;
    private String branchName;
    private Long userId;
    private String userName;
    private SaleStatus status;
    private String cancellationReason;
    private String customerName;
    private String customerDocument;
    private BigDecimal globalDiscountPercentage;
    private List<SaleDetail> details;

    public Sale(Long id, LocalDateTime date, Long branchId, String branchName, Long userId, String userName, SaleStatus status, 
                String cancellationReason, String customerName, String customerDocument, BigDecimal globalDiscountPercentage, List<SaleDetail> details) {
        if (details == null || details.isEmpty()) {
            throw new EmptySaleException("Una factura de venta no puede estar vacía.");
        }
        if (branchId == null) {
            throw new IllegalArgumentException("La sucursal es obligatoria.");
        }
        if (userId == null) {
            throw new IllegalArgumentException("El usuario es obligatorio.");
        }
        
        this.id = id;
        this.date = date != null ? date : LocalDateTime.now();
        this.branchId = branchId;
        this.branchName = branchName;
        this.userId = userId;
        this.userName = userName;
        this.status = status != null ? status : SaleStatus.COMPLETED;
        this.cancellationReason = cancellationReason;
        this.customerName = customerName;
        this.customerDocument = customerDocument;
        this.globalDiscountPercentage = globalDiscountPercentage != null ? globalDiscountPercentage : BigDecimal.ZERO;
        this.details = details;
        
        // Calcular matemática financiera en el backend (Source of Truth)
        calculateFinancials();
    }

    public static Sale create(Long branchId, String branchName, Long userId, String userName, String customerName, String customerDocument, BigDecimal globalDiscountPercentage, List<SaleDetail> details) {
        return new Sale(null, LocalDateTime.now(), branchId, branchName, userId, userName, SaleStatus.COMPLETED, null, customerName, customerDocument, globalDiscountPercentage, details);
    }

    public void cancel(String reason) {
        if (this.status == SaleStatus.CANCELED) {
            throw new IllegalStateException("Esta venta ya se encuentra anulada.");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("El motivo de la anulación es obligatorio.");
        }
        this.status = SaleStatus.CANCELED;
        this.cancellationReason = reason;
    }

    public void markAsReturned() {
        if (this.status == SaleStatus.CANCELED) {
            throw new IllegalStateException("No se puede marcar como devolución una venta ya anulada.");
        }
        this.status = SaleStatus.RETURNED;
    }

    private void calculateFinancials() {
        // 1. Subtotal Base: Suma de (cantidad * precio_pactado) de cada línea SIN descuentos de línea
        this.subtotal = this.details.stream()
                .map(d -> d.getUnitPriceApplied().multiply(BigDecimal.valueOf(d.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // 2. Suma de Totales de Línea (Ya incluyen sus descuentos individuales)
        BigDecimal totalLineasConDescuento = this.details.stream()
                .map(SaleDetail::getSubtotalLine)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // 3. Aplicar Descuento Global sobre el total de líneas
        BigDecimal valorDescuentoGlobal = BigDecimal.ZERO;
        if (this.globalDiscountPercentage.compareTo(BigDecimal.ZERO) > 0) {
            valorDescuentoGlobal = totalLineasConDescuento
                    .multiply(this.globalDiscountPercentage)
                    .divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
        }

        // 4. Total Final = Total Líneas - Descuento Global
        this.totalFinal = totalLineasConDescuento.subtract(valorDescuentoGlobal)
                .setScale(2, java.math.RoundingMode.HALF_UP);

        // 5. Descuento Total Acumulado = (Subtotal Base - Total Final)
        this.totalDiscount = this.subtotal.subtract(this.totalFinal)
                .setScale(2, java.math.RoundingMode.HALF_UP);
    }

    // Getters
    public Long getId() { return id; }
    public LocalDateTime getDate() { return date; }
    public BigDecimal getSubtotal() { return subtotal; }
    public BigDecimal getTotalDiscount() { return totalDiscount; }
    public BigDecimal getTotalFinal() { return totalFinal; }
    public Long getBranchId() { return branchId; }
    public String getBranchName() { return branchName; }
    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public SaleStatus getStatus() { return status; }
    public String getCancellationReason() { return cancellationReason; }
    public String getCustomerName() { return customerName; }
    public String getCustomerDocument() { return customerDocument; }
    public BigDecimal getGlobalDiscountPercentage() { return globalDiscountPercentage; }
    public List<SaleDetail> getDetails() { return Collections.unmodifiableList(details); }
}
