package co.com.zenvory.inventario.transfer.domain.model;

public enum TransferStatus {
    PENDING,
    PREPARING,
    IN_TRANSIT,
    DELIVERED,
    WITH_ISSUE,
    UNDER_CLAIM,
    CANCELLED
}
