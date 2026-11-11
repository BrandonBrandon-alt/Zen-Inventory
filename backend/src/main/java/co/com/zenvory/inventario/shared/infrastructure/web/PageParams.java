package co.com.zenvory.inventario.shared.infrastructure.web;

/** Página pedida, ya acotada: página desde 0 y entre 1 y {@value #MAX_SIZE} filas. Igual en todas las búsquedas paginadas. */
public record PageParams(int page, int size) {

    public static final int MAX_SIZE = 100;

    public static PageParams of(int page, int size) {
        return new PageParams(Math.max(0, page), Math.min(Math.max(1, size), MAX_SIZE));
    }

    public int totalPages(long totalElements) {
        return (int) Math.ceil(totalElements / (double) size);
    }
}
