package co.com.zenvory.inventario.audit.domain.service;

import co.com.zenvory.inventario.audit.domain.model.FieldChange;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static co.com.zenvory.inventario.audit.domain.service.ChangeText.NONE;
import static co.com.zenvory.inventario.audit.domain.service.ChangeText.money;
import static co.com.zenvory.inventario.audit.domain.service.ChangeText.sameAmount;

/**
 * Qué cambió en un producto entre dos versiones, campo por campo y ya escrito para mostrarse. Puro: no consulta nada,
 * el nombre de cada proveedor llega por {@code supplierName}. El nombre, el SKU y la unidad no se auditan.
 */
public final class ProductChanges {

    private ProductChanges() {
    }

    public static List<FieldChange> diff(Product before, Product after, Function<Long, String> supplierName) {
        List<FieldChange> changes = new ArrayList<>();
        if (!sameAmount(before.getSalePrice(), after.getSalePrice())) {
            changes.add(new FieldChange("Precio de venta", money(before.getSalePrice()), money(after.getSalePrice())));
        }
        if (!sameAmount(before.getAverageCost(), after.getAverageCost())) {
            changes.add(new FieldChange("Costo promedio", money(before.getAverageCost()), money(after.getAverageCost())));
        }
        if (!ChangeText.active(before.getActive()).equals(ChangeText.active(after.getActive()))) {
            changes.add(new FieldChange("Estado", ChangeText.active(before.getActive()), ChangeText.active(after.getActive())));
        }
        suppliers(before, after, supplierName, changes);
        return changes;
    }

    /** El mínimo de una sucursal: sin mínimo definido cuenta como 0. Vacío si no cambió. */
    public static Optional<FieldChange> minimumStock(BigDecimal before, BigDecimal after, String branchName) {
        BigDecimal from = before == null ? BigDecimal.ZERO : before;
        BigDecimal to = after == null ? BigDecimal.ZERO : after;
        if (sameAmount(from, to)) {
            return Optional.empty();
        }
        return Optional.of(new FieldChange("Stock mínimo (" + branchName + ")", ChangeText.number(from), ChangeText.number(to)));
    }

    private static void suppliers(Product before, Product after, Function<Long, String> supplierName, List<FieldChange> changes) {
        Map<Long, ProductSupplierDetail> old = bySupplier(before.getSuppliersDetails());
        Map<Long, ProductSupplierDetail> now = bySupplier(after.getSuppliersDetails());
        for (ProductSupplierDetail was : old.values()) {
            String name = supplierName.apply(was.supplierId());
            ProductSupplierDetail is = now.get(was.supplierId());
            if (is == null) {
                changes.add(new FieldChange("Proveedor " + name, added(was), "Quitado"));
                continue;
            }
            if (!sameAmount(was.negotiatedPrice(), is.negotiatedPrice())) {
                changes.add(new FieldChange("Precio pactado (" + name + ")", money(was.negotiatedPrice()), money(is.negotiatedPrice())));
            }
            if (!ChangeText.same(was.deliveryDays(), is.deliveryDays())) {
                changes.add(new FieldChange("Días de entrega (" + name + ")", days(was.deliveryDays()), days(is.deliveryDays())));
            }
            if (Boolean.TRUE.equals(was.preferred()) != Boolean.TRUE.equals(is.preferred())) {
                changes.add(new FieldChange("Preferido (" + name + ")", ChangeText.yesNo(was.preferred()), ChangeText.yesNo(is.preferred())));
            }
        }
        for (ProductSupplierDetail is : now.values()) {
            if (!old.containsKey(is.supplierId())) {
                changes.add(new FieldChange("Proveedor " + supplierName.apply(is.supplierId()), NONE, added(is)));
            }
        }
    }

    private static String added(ProductSupplierDetail detail) {
        return "Agregado · " + money(detail.negotiatedPrice()) + " · " + days(detail.deliveryDays());
    }

    private static String days(Integer days) {
        if (days == null) {
            return NONE;
        }
        return days == 1 ? "1 día" : days + " días";
    }

    private static Map<Long, ProductSupplierDetail> bySupplier(List<ProductSupplierDetail> details) {
        Map<Long, ProductSupplierDetail> map = new LinkedHashMap<>();
        if (details != null) {
            for (ProductSupplierDetail detail : details) {
                map.put(detail.supplierId(), detail);
            }
        }
        return map;
    }
}
