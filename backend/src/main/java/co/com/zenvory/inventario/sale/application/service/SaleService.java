package co.com.zenvory.inventario.sale.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.pricelist.application.port.in.PriceListUseCase;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.application.port.out.SaleRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import co.com.zenvory.inventario.sale.domain.model.SaleDetail;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class SaleService implements CreateSaleUseCase, SaleManagementUseCase {

    private final SaleRepositoryPort saleRepositoryPort;
    private final ProductUseCase productUseCase;
    private final InventoryUseCase inventoryUseCase;
    private final BranchUseCase branchUseCase;
    private final UserUseCase userUseCase;
    private final PriceListUseCase priceListUseCase;
    private final AlertUseCase alertUseCase;

    public SaleService(SaleRepositoryPort saleRepositoryPort, ProductUseCase productUseCase, InventoryUseCase inventoryUseCase,
                       BranchUseCase branchUseCase, UserUseCase userUseCase, PriceListUseCase priceListUseCase, AlertUseCase alertUseCase) {
        this.saleRepositoryPort = saleRepositoryPort;
        this.productUseCase = productUseCase;
        this.inventoryUseCase = inventoryUseCase;
        this.branchUseCase = branchUseCase;
        this.userUseCase = userUseCase;
        this.priceListUseCase = priceListUseCase;
        this.alertUseCase = alertUseCase;
    }

    @Override
    @Transactional
    public Sale execute(CreateSaleCommand command) {
        // 1. Resolver precios y construir detalles de la venta
        List<SaleDetail> details = command.items().stream()
                .map(item -> {
                    Product product = productUseCase.getProductById(item.productId());

                    // Jerarquía de Precios: Detalle -> Global -> Base
                    Long effectiveListId = (item.priceListId() != null) ? item.priceListId() : command.priceListId();

                    BigDecimal price = (effectiveListId != null) 
                            ? priceListUseCase.getPriceForProduct(effectiveListId, item.productId()).orElse(product.getSalePrice())
                            : product.getSalePrice();

                    return SaleDetail.create(
                            item.productId(),
                            product.getName(),
                            item.quantity(),
                            price,
                            item.discountPercentage()
                    );
                }).toList();

        // 1.1 Pre-validar stock para todos los productos antes de persistir
        for (SaleDetail detail : details) {
            co.com.zenvory.inventario.inventory.domain.model.LocalInventory inventory = 
                    inventoryUseCase.getInventory(command.branchId(), detail.getProductId());
            
            if (!inventory.hasSufficientStock(BigDecimal.valueOf(detail.getQuantity()))) {
                throw new co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException(
                        detail.getProductName(), 
                        BigDecimal.valueOf(detail.getQuantity()), 
                        inventory.getCurrentQuantity()
                );
            }
        }

        // 2. Obtener nombres de sucursal y vendedor para el snapshot
        String branchName = branchUseCase.getBranchById(command.branchId()).getName();
        String userName = userUseCase.getUserById(command.userId()).getNombre();

        // 3. Crear el agregado (con información de cliente)
        Sale sale = Sale.create(
                command.branchId(),
                branchName,
                command.userId(),
                userName,
                command.customerName(),
                command.customerDocument(),
                command.globalDiscountPercentage(),
                details
        );

        // 3. Persistir la venta
        Sale savedSale = saleRepositoryPort.save(sale);

        // 4. Descontar stock
        for (SaleDetail detail : details) {
            inventoryUseCase.withdrawStock(
                    command.branchId(), 
                    detail.getProductId(), 
                    detail.getProductName(),
                    BigDecimal.valueOf(detail.getQuantity()), 
                    null,
                    MovementReason.VENTA, 
                    command.userId(),
                    savedSale.getId(),
                    "VENTA",
                    null,
                    null
            );
        }

        return savedSale;
    }

    @Override
    public List<Sale> getAllSales() {
        return saleRepositoryPort.findAll();
    }

    @Override
    public List<Sale> getSalesByBranch(Long branchId) {
        return saleRepositoryPort.findByBranchId(branchId);
    }

    @Override
    public Sale getSaleById(Long id) {
        return saleRepositoryPort.findById(id)
                .orElseThrow(() -> new RuntimeException("Venta no encontrada con ID: " + id));
    }

    @Override
    @Transactional
    public void cancelSale(Long id, String reason, Long restrictedBranchId) {
        // 1. Obtener la venta
        Sale sale = getSaleById(id);

        // 2. Seguridad: Validar que si hay restricción, la venta pertenezca a la sucursal
        if (restrictedBranchId != null && !sale.getBranchId().equals(restrictedBranchId)) {
            throw new UnauthorizedActionException(
                    "No tiene permisos para anular ventas de otra sucursal."
            );
        }

        // 3. Aplicar lógica de anulación en el dominio
        sale.cancel(reason);

        // 4. Persistir cambio de estado
        saleRepositoryPort.save(sale);

        // 5. Rollback de Stock: Devolver productos al inventario
        for (SaleDetail detail : sale.getDetails()) {
            inventoryUseCase.addStock(
                    sale.getBranchId(),
                    detail.getProductId(),
                    BigDecimal.valueOf(detail.getQuantity()),
                    null,
                    MovementReason.DEVOLUCION,
                    sale.getUserId(), 
                    sale.getId(),
                    "ANULACION_VENTA",
                    detail.getUnitPriceApplied(),
                    "Anulación #" + id + ": " + reason,
                    null
            );
        }
    }
    @Override
    @Transactional
    public void updateSaleStatus(Long id, co.com.zenvory.inventario.sale.domain.model.SaleStatus status) {
        if (status == co.com.zenvory.inventario.sale.domain.model.SaleStatus.RETURNED) {
            Sale sale = getSaleById(id);
            sale.markAsReturned();
            saleRepositoryPort.save(sale);
        } else {
            saleRepositoryPort.updateStatus(id, status);
        }
    }
}
