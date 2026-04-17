package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.transfer.application.port.in.DispatchTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.ReceiveTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/transfers")
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class TransferController {

    private final TransferUseCase transferUseCase;

    public TransferController(TransferUseCase transferUseCase) {
        this.transferUseCase = transferUseCase;
    }

    @PostMapping
    public ResponseEntity<TransferResponse> requestTransfer(@Valid @RequestBody TransferRequest request) {
        RequestTransferCommand command = new RequestTransferCommand(
                request.originBranchId(),
                request.destinationBranchId(),
                request.estimatedArrivalDate(),
                request.items().stream()
                        .map(item -> new RequestTransferCommand.Detail(item.productId(), item.requestedQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.requestTransfer(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<TransferResponse> dispatchTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferDispatchRequest request) {
        
        DispatchTransferCommand command = new DispatchTransferCommand(
                request.userId(),
                request.carrier(),
                request.items().stream()
                        .map(item -> new DispatchTransferCommand.DispatchDetail(item.detailId(), item.sentQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.dispatchTransfer(id, command);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/prepare")
    public ResponseEntity<TransferResponse> prepareTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferPrepareRequest request) {
        
        java.util.List<co.com.zenvory.inventario.transfer.application.port.in.UpdateQuantityCommand> items = request.items().stream()
                .map(item -> new co.com.zenvory.inventario.transfer.application.port.in.UpdateQuantityCommand(item.productId(), item.requestedQuantity()))
                .toList();

        Transfer transfer = transferUseCase.prepareTransfer(id, items);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<TransferResponse> receiveTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferReceiveRequest request) {
        
        ReceiveTransferCommand command = new ReceiveTransferCommand(
                request.userId(),
                request.notes(),
                request.items().stream()
                        .map(item -> new ReceiveTransferCommand.ReceivedDetail(item.detailId(), item.receivedQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.receiveTransfer(id, command);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/resolve-shrinkage")
    public ResponseEntity<Void> resolveAsShrinkage(@PathVariable Long id) {
        transferUseCase.resolveAsShrinkage(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resolve-resend")
    public ResponseEntity<Void> resolveAsResend(@PathVariable Long id) {
        transferUseCase.resolveAsResend(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resolve-claim")
    public ResponseEntity<Void> resolveAsClaim(@PathVariable Long id) {
        transferUseCase.resolveAsClaim(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelTransfer(@PathVariable Long id) {
        transferUseCase.cancelTransfer(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransferResponse> getTransfer(@PathVariable Long id) {
        Transfer transfer = transferUseCase.getTransferById(id);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @GetMapping
    public ResponseEntity<java.util.List<TransferResponse>> getAllTransfers() {
        return ResponseEntity.ok(transferUseCase.getAllTransfers().stream()
                .map(TransferResponse::fromDomain)
                .toList());
    }
}
