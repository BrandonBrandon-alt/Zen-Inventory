package co.com.zenvory.inventario.audit.domain.service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Objects;

/** Cómo se escribe cada valor en la auditoría: igual que en las pantallas (es-CO). */
final class ChangeText {

    static final String NONE = "—";

    private ChangeText() {
    }

    static String money(BigDecimal value) {
        return value == null ? NONE : "$ " + number(value);
    }

    static String number(BigDecimal value) {
        if (value == null) {
            return NONE;
        }
        DecimalFormatSymbols symbols = new DecimalFormatSymbols();
        symbols.setGroupingSeparator('.');
        symbols.setDecimalSeparator(',');
        DecimalFormat format = new DecimalFormat("#,##0.##", symbols);
        return format.format(value);
    }

    static String active(Boolean active) {
        return Boolean.FALSE.equals(active) ? "Inactivo" : "Activo";
    }

    static String yesNo(Boolean value) {
        return Boolean.TRUE.equals(value) ? "Sí" : "No";
    }

    /** Dos importes son el mismo aunque tengan distinta escala (34000 y 34000.00). */
    static boolean sameAmount(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return a == b;
        }
        return a.compareTo(b) == 0;
    }

    static boolean same(Object a, Object b) {
        return Objects.equals(a, b);
    }
}
