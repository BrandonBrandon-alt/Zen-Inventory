package co.com.zenvory.inventario.shared.infrastructure.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PageParams — página segura")
class PageParamsTest {

    @Test
    @DisplayName("acota la página (≥ 0) y el tamaño (1 a 100), y calcula el total de páginas")
    void acota() {
        assertThat(PageParams.of(-3, 5000)).isEqualTo(new PageParams(0, 100));
        assertThat(PageParams.of(2, 0)).isEqualTo(new PageParams(2, 1));
        assertThat(PageParams.of(0, 15).totalPages(31)).isEqualTo(3);
        assertThat(PageParams.of(0, 15).totalPages(0)).isZero();
    }
}
