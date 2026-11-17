package co.com.zenvory.inventario.shared.infrastructure.persistence;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Búsqueda de texto en SQL igual en todas las pantallas: sin distinguir mayúsculas ni tildes («rios» encuentra «Ríos»)
 * y sin que un {@code %} o un {@code _} escritos por la persona actúen como comodines de LIKE.
 */
public final class SqlText {

    /** Letras con tilde y su equivalente sin tilde, en el mismo orden (para {@code translate} de PostgreSQL). */
    public static final String ACCENTED = "áéíóúüñàèìòùâêîôû";
    public static final String UNACCENTED = "aeiouunaeiouaeiou";

    private SqlText() {
    }

    /** Minúsculas, sin tildes y recortado: lo que se compara contra {@link #plain}. */
    public static String normalize(String text) {
        return Normalizer.normalize(text.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    /** {@code %palabra%} para LIKE, con {@code \}, {@code %} y {@code _} escapados (escape por defecto: {@code \}). */
    public static String containsPattern(String word) {
        return "%" + word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** La columna en minúsculas y sin tildes, para compararla con un texto normalizado. */
    public static String plain(String column) {
        return "translate(lower(coalesce(" + column + ", '')), '" + ACCENTED + "', '" + UNACCENTED + "')";
    }

    /** Las palabras buscadas, normalizadas y sin {@code #} («#41» se busca como 41), hasta {@code max}. */
    public static List<String> words(String text, int max) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(normalize(text).split("\\s+"))
                .map(word -> word.replace("#", ""))
                .filter(word -> !word.isEmpty())
                .limit(max)
                .toList();
    }
}
