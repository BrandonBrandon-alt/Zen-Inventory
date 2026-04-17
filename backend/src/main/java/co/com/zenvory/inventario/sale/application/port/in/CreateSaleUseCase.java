package co.com.zenvory.inventario.sale.application.port.in;

import co.com.zenvory.inventario.sale.domain.model.Sale;

public interface CreateSaleUseCase {
    Sale execute(CreateSaleCommand command);
}
