package co.com.zenvory.inventario.transfer.application.port.in;

import co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort;
import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import java.util.List;

public interface TransferUseCase {
    Transfer requestTransfer(RequestTransferCommand command);
    Transfer prepareTransfer(Long transferId, java.util.List<UpdateQuantityCommand> items);
    Transfer dispatchTransfer(Long transferId, DispatchTransferCommand command);
    Transfer receiveTransfer(Long transferId, ReceiveTransferCommand command);
    Transfer approveDestination(Long transferId);
    void cancelTransfer(Long id, String reason);

    /**
     * Registra un pago o abono del flete al transportista. El ADMIN lo hace sobre cualquier traslado; el gerente, solo
     * en los que despachó su sucursal (la que contrata el envío).
     *
     * @param amount monto pagado; {@code null} paga todo el saldo pendiente
     */
    Transfer registerFreightPayment(Long transferId, java.math.BigDecimal amount,
            co.com.zenvory.inventario.transfer.domain.model.TransferPaymentMethod method, String reference, String notes);

    /** Anula un pago del flete equivocado (contra-asiento); lo hace quien puede pagarlo (la sucursal de origen). */
    Transfer voidFreightPayment(Long transferId, Long paymentId, String reason);
    void rejectTransfer(Long id, String reason);
    void resolveAsShrinkage(Long transferId);
    void resolveAsResend(Long transferId);
    void resolveAsClaim(Long transferId);
    Transfer getTransferById(Long transferId);
    List<Transfer> getAllTransfers();
    List<Transfer> getTransfersByBranch(Long branchId);

    /** La lista de la pantalla de traslados: filtrada, ordenada y paginada en la base, con «te toca» de quien mira. */
    TransferSearchPort.Page search(TransferSearchPort.Criteria criteria, PageParams page, String sortBy, boolean ascending);

    /** Los totales del encabezado de traslados sobre todo lo que ve quien mira. */
    TransferSearchPort.Summary summary(Viewer viewer);
    /** Traslado visible para el usuario actual: solo si es ADMIN o su sucursal es el origen o el destino. */
    Transfer getTransferForCurrentUser(Long id);

    /** @param branchId limita el informe a los traslados de esa sucursal; {@code null} = todas (ADMIN). */
    co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.TransferFulfillmentReport getFulfillmentReport(Long branchId);
    /** @param branchId limita el análisis a los traslados de esa sucursal; {@code null} = todas (ADMIN). */
    co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse getLogisticsAnalytics(Long branchId);
}
