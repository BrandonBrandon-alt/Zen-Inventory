package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "detalles_transferencia")
public class TransferDetailEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transferencia_id", nullable = false)
    private TransferEntity transfer;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "cantidad_solicitada", nullable = false)
    private Integer requestedQuantity;

    @Column(name = "cantidad_enviada", nullable = false)
    private Integer sentQuantity;

    @Column(name = "cantidad_recibida", nullable = false)
    private Integer receivedQuantity;

    @Column(name = "faltantes", nullable = false)
    private Integer missingQuantity;

    public TransferDetailEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TransferEntity getTransfer() { return transfer; }
    public void setTransfer(TransferEntity transfer) { this.transfer = transfer; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public Integer getRequestedQuantity() { return requestedQuantity; }
    public void setRequestedQuantity(Integer requestedQuantity) { this.requestedQuantity = requestedQuantity; }

    public Integer getSentQuantity() { return sentQuantity; }
    public void setSentQuantity(Integer sentQuantity) { this.sentQuantity = sentQuantity; }

    public Integer getReceivedQuantity() { return receivedQuantity; }
    public void setReceivedQuantity(Integer receivedQuantity) { this.receivedQuantity = receivedQuantity; }

    public Integer getMissingQuantity() { return missingQuantity; }
    public void setMissingQuantity(Integer missingQuantity) { this.missingQuantity = missingQuantity; }
}
