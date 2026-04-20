package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;

import java.time.LocalDateTime;
import java.util.List;

public record ReturnRequestResponse(
    Long id,
    Long saleId,
    Long sucursalId,
    Long solicitanteId,
    Long aprobadorId,
    ReturnRequestStatus estado,
    LocalDateTime fechaSolicitud,
    LocalDateTime fechaProcesamiento,
    String motivoGeneral,
    String comentarioAprobador,
    List<Detail> items
) {
    public record Detail(
        Long id,
        Long productoId,
        Integer cantidad,
        String motivoEspecifico,
        java.math.BigDecimal precioUnidadVenta
    ) {}

    public static ReturnRequestResponse fromDomain(ReturnRequest domain) {
        return new ReturnRequestResponse(
            domain.getId(),
            domain.getSaleId(),
            domain.getBranchId(),
            domain.getRequesterId(),
            domain.getApproverId(),
            domain.getStatus(),
            domain.getRequestDate(),
            domain.getProcessingDate(),
            domain.getGeneralReason(),
            domain.getApproverComment(),
            domain.getDetails().stream()
                .map(d -> new Detail(d.getId(), d.getProductId(), d.getQuantity(), d.getReasonSpecific(), d.getUnitPricePaid()))
                .toList()
        );
    }
}
