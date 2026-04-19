package co.com.zenvory.inventario.transfer.application.port.in;

import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import java.util.List;

public interface TransferUseCase {
    Transfer requestTransfer(RequestTransferCommand command);
    Transfer prepareTransfer(Long transferId, java.util.List<UpdateQuantityCommand> items);
    Transfer dispatchTransfer(Long transferId, DispatchTransferCommand command);
    Transfer receiveTransfer(Long transferId, ReceiveTransferCommand command);
    Transfer approveDestination(Long transferId);
    void cancelTransfer(Long id, String reason);
    void rejectTransfer(Long id, String reason);
    void resolveAsShrinkage(Long transferId);
    void resolveAsResend(Long transferId);
    void resolveAsClaim(Long transferId);
    Transfer getTransferById(Long transferId);
    List<Transfer> getAllTransfers();
    List<Transfer> getTransfersByBranch(Long branchId);
    co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.TransferFulfillmentReport getFulfillmentReport();
}
