package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.SupplierUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.SupplierRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de aplicación para Proveedores.
 * Orquesta los casos de uso del proveedor delegando al puerto de salida.
 */
@Service
public class SupplierService implements SupplierUseCase {

    private final SupplierRepositoryPort supplierRepositoryPort;

    public SupplierService(SupplierRepositoryPort supplierRepositoryPort) {
        this.supplierRepositoryPort = supplierRepositoryPort;
    }

    @Override
    public List<Supplier> getAllSuppliers() {
        return supplierRepositoryPort.findAll();
    }

    @Override
    public Supplier getSupplierById(Long id) {
        return supplierRepositoryPort.findById(id)
                .orElseThrow(() -> new SupplierNotFoundException(id));
    }

    @Override
    public Supplier createSupplier(Supplier supplier) {
        return supplierRepositoryPort.save(supplier);
    }

    @Override
    public Supplier updateSupplier(Long id, Supplier supplier) {
        Supplier existing = supplierRepositoryPort.findById(id)
                .orElseThrow(() -> new SupplierNotFoundException(id));

        existing.setName(supplier.getName());
        existing.setContact(supplier.getContact());
        existing.setDeliveryDays(supplier.getDeliveryDays());

        return supplierRepositoryPort.save(existing);
    }

    @Override
    public void deleteSupplier(Long id) {
        if (!supplierRepositoryPort.existsById(id)) {
            throw new SupplierNotFoundException(id);
        }
        supplierRepositoryPort.deleteById(id);
    }

    @Override
    public List<Supplier> getSuppliersByProductId(Long productId) {
        return supplierRepositoryPort.findAllByProductId(productId);
    }

    @Override
    public List<co.com.zenvory.inventario.catalog.domain.model.Product> getProductsBySupplierId(Long supplierId) {
        return supplierRepositoryPort.findAllProductsBySupplierId(supplierId);
    }
}
