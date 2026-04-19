package co.com.zenvory.inventario.transfer.domain.model;

public enum TransferStatus {
    PENDING,
    APPROVED_DEST,
    PREPARING,
    IN_TRANSIT,
    DELIVERED,
    WITH_ISSUE,
    UNDER_CLAIM,
    CANCELLED,
    REJECTED
}
