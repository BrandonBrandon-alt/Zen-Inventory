package co.com.zenvory.inventario.audit.domain.model;

/** Un campo que cambió, con su nombre y sus valores ya escritos como se muestran («$ 34.000», «Activo», «Gerente»). */
public record FieldChange(String field, String before, String after) {
}
