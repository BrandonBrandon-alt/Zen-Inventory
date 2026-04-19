package co.com.zenvory.inventario.transfer.domain.model;

public class TransferDetail {
    private Long id;
    private Long productId;
    private Integer requestedQuantity;
    private Integer sentQuantity;
    private Integer receivedQuantity;
    private Integer missingQuantity;
    private String productName;

    public TransferDetail(Long id, Long productId, String productName, Integer requestedQuantity, Integer sentQuantity, Integer receivedQuantity, Integer missingQuantity) {
        if (requestedQuantity == null || requestedQuantity <= 0) {
            throw new IllegalArgumentException("La cantidad solicitada debe ser mayor a cero.");
        }
        this.id = id;
        this.productId = productId;
        this.requestedQuantity = requestedQuantity;
        this.sentQuantity = sentQuantity != null ? sentQuantity : 0;
        this.receivedQuantity = receivedQuantity != null ? receivedQuantity : 0;
        this.missingQuantity = missingQuantity != null ? missingQuantity : 0;
        this.productName = productName;
    }

    public static TransferDetail create(Long productId, String productName, Integer requestedQuantity) {
        return new TransferDetail(null, productId, productName, requestedQuantity, 0, 0, 0);
    }

    public void registerDispatch(Integer sent) {
        if (sent == null || sent < 0) {
            throw new IllegalArgumentException("La cantidad enviada no puede ser nula ni negativa.");
        }
        this.sentQuantity = sent;
    }

    public void registerReceipt(Integer received) {
        if (received == null || received < 0) {
            throw new IllegalArgumentException("La cantidad recibida no puede ser nula ni negativa.");
        }
        this.receivedQuantity = received;
        this.missingQuantity = Math.max(0, this.sentQuantity - this.receivedQuantity);
    }

    public Long getId() { return id; }
    public Long getProductId() { return productId; }
    public Integer getRequestedQuantity() { return requestedQuantity; }
    public Integer getSentQuantity() { return sentQuantity; }
    public Integer getReceivedQuantity() { return receivedQuantity; }
    public Integer getMissingQuantity() { return missingQuantity; }
    public String getProductName() { return productName; }
}
