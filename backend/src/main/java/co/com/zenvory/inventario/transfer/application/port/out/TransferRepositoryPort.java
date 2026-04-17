package co.com.zenvory.inventario.transfer.application.port.out;

import co.com.zenvory.inventario.transfer.domain.model.Transfer;

import java.util.List;
import java.util.Optional;

public interface TransferRepositoryPort {
    Transfer save(Transfer transfer);
    Optional<Transfer> findById(Long id);
    List<Transfer> findAll();
}
