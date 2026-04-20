package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.SupplierUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.SupplierRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Servicio de aplicación que implementa la orquestación de lógica para proveedores.
 * 
 * <p>Gestiona el registro de proveedores y expone consultas sobre las relaciones 
 * entre estos y los productos del catálogo.</p>
 */
@Service
public class SupplierService implements SupplierUseCase {

    private final SupplierRepositoryPort supplierRepositoryPort;

    /**
     * Constructor con inyección de dependencias.
     * @param supplierRepositoryPort Puerto de salida para persistencia de proveedores.
     */
    public SupplierService(SupplierRepositoryPort supplierRepositoryPort) {
        this.supplierRepositoryPort = supplierRepositoryPort;
    }

    /** {@inheritDoc} */
    @Override
    public List<Supplier> getAllSuppliers() {
        return supplierRepositoryPort.findAll();
    }

    /** 
     * {@inheritDoc} 
     * @throws SupplierNotFoundException Si el ID solicitado no existe.
     */
    @Override
    public Supplier getSupplierById(Long id) {
        return supplierRepositoryPort.findById(id)
                .orElseThrow(() -> new SupplierNotFoundException(id));
    }

    /** {@inheritDoc} */
    @Override
    public Supplier createSupplier(Supplier supplier) {
        return supplierRepositoryPort.save(supplier);
    }

    /** {@inheritDoc} */
    @Override
    public Supplier updateSupplier(Long id, Supplier supplier) {
        Supplier existing = supplierRepositoryPort.findById(id)
                .orElseThrow(() -> new SupplierNotFoundException(id));

        existing.setName(supplier.getName());
        existing.setContact(supplier.getContact());
        existing.setDeliveryDays(supplier.getDeliveryDays());

        return supplierRepositoryPort.save(existing);
    }

    /** 
     * {@inheritDoc} 
     * @throws SupplierNotFoundException Si el ID de proveedor no es válido.
     */
    @Override
    public void deleteSupplier(Long id) {
        if (!supplierRepositoryPort.existsById(id)) {
            throw new SupplierNotFoundException(id);
        }
        supplierRepositoryPort.deleteById(id);
    }

    /** {@inheritDoc} */
    @Override
    public List<Supplier> getSuppliersByProductId(Long productId) {
        return supplierRepositoryPort.findAllByProductId(productId);
    }

    /** {@inheritDoc} */
    @Override
    public List<co.com.zenvory.inventario.catalog.domain.model.Product> getProductsBySupplierId(Long supplierId) {
        return supplierRepositoryPort.findAllProductsBySupplierId(supplierId);
    }
}

