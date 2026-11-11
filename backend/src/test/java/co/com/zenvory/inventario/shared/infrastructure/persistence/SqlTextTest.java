package co.com.zenvory.inventario.shared.infrastructure.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("SqlText — búsqueda de texto en SQL")
class SqlTextTest {

    @Test
    @DisplayName("normalize: minúsculas, sin tildes y recortado")
    void normalize_quitaTildesYMayusculas() {
        assertThat(SqlText.normalize("  REVISIÓN Ñandú ")).isEqualTo("revision nandu");
    }

    @Test
    @DisplayName("containsPattern: escapa los comodines de LIKE y la barra")
    void containsPattern_escapaComodines() {
        assertThat(SqlText.containsPattern("100%_a\\b")).isEqualTo("%100\\%\\_a\\\\b%");
    }

    @Test
    @DisplayName("words: normalizadas, sin numeral y con límite")
    void words_sinNumeralYConLimite() {
        assertThat(SqlText.words("Venta  #41 x y z w", 5)).containsExactly("venta", "41", "x", "y", "z");
        assertThat(SqlText.words(null, 5)).isEmpty();
        assertThat(SqlText.words("   ", 5)).isEmpty();
    }

    @Test
    @DisplayName("plain: la columna en minúsculas y sin tildes, también las graves y circunflejas")
    void plain_traduceTildes() {
        assertThat(SqlText.plain("p.nombre")).isEqualTo("translate(lower(coalesce(p.nombre, '')), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou')");
    }
}
