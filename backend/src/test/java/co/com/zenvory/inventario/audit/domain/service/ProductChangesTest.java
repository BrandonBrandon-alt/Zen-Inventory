package co.com.zenvory.inventario.audit.domain.service;

import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ProductChanges — qué cambió en un producto")
class ProductChangesTest {

    private static final Function<Long, String> SUPPLIERS = Map.of(1L, "Argos", 2L, "Cemex")::get;

    private static Product product(String price, String cost, boolean active, ProductSupplierDetail... suppliers) {
        return Product.builder().id(5L).name("Cemento").salePrice(new BigDecimal(price)).averageCost(new BigDecimal(cost))
                .active(active).suppliersDetails(List.of(suppliers)).build();
    }

    private static ProductSupplierDetail supplier(long id, String price, int days, boolean preferred) {
        return new ProductSupplierDetail(id, new BigDecimal(price), days, preferred);
    }

    @Test
    @DisplayName("sin cambios no devuelve nada (34000 y 34000.00 son el mismo precio)")
    void sinCambios_noDevuelveNada() {
        Product before = product("34000", "20000", true, supplier(1, "28000", 3, true));
        Product after = product("34000.00", "20000.0", true, supplier(1, "28000.00", 3, true));

        assertThat(ProductChanges.diff(before, after, SUPPLIERS)).isEmpty();
    }

    @Test
    @DisplayName("precio de venta y estado, con dinero y Activo/Inactivo")
    void precioYEstado() {
        List<FieldChange> changes = ProductChanges.diff(product("34000", "20000", true), product("36500", "20000", false), SUPPLIERS);

        assertThat(changes).containsExactly(
                new FieldChange("Precio de venta", "$ 34.000", "$ 36.500"),
                new FieldChange("Estado", "Activo", "Inactivo"));
    }

    @Test
    @DisplayName("el costo promedio solo aparece si cambió")
    void costoSoloSiCambia() {
        assertThat(ProductChanges.diff(product("34000", "20000", true), product("34000", "21000.5", true), SUPPLIERS))
                .containsExactly(new FieldChange("Costo promedio", "$ 20.000", "$ 21.000,5"));
    }

    @Test
    @DisplayName("proveedor agregado, quitado, precio pactado y preferido")
    void proveedorAgregadoQuitadoYPrecioPactado() {
        Product before = product("1", "1", true, supplier(1, "28000", 3, true), supplier(2, "30000", 5, false));
        Product after = product("1", "1", true, supplier(1, "27000", 3, false), supplier(3, "26000", 2, true));

        assertThat(ProductChanges.diff(before, after, Map.of(1L, "Argos", 2L, "Cemex", 3L, "Holcim")::get)).containsExactly(
                new FieldChange("Precio pactado (Argos)", "$ 28.000", "$ 27.000"),
                new FieldChange("Preferido (Argos)", "Sí", "No"),
                new FieldChange("Proveedor Cemex", "Agregado · $ 30.000 · 5 días", "Quitado"),
                new FieldChange("Proveedor Holcim", "—", "Agregado · $ 26.000 · 2 días"));
    }

    @Test
    @DisplayName("el stock mínimo se registra por sucursal y solo si cambió")
    void minimoPorSucursal() {
        assertThat(ProductChanges.minimumStock(new BigDecimal("5"), new BigDecimal("8.0"), "Sucursal Norte"))
                .contains(new FieldChange("Stock mínimo (Sucursal Norte)", "5", "8"));
        assertThat(ProductChanges.minimumStock(new BigDecimal("5"), new BigDecimal("5.00"), "Sucursal Norte")).isEmpty();
        assertThat(ProductChanges.minimumStock(null, new BigDecimal("2"), "Sur"))
                .contains(new FieldChange("Stock mínimo (Sur)", "0", "2"));
    }
}
