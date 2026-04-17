package co.com.zenvory.inventario;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Test de integración del contexto completo de Spring.
 * Requiere una base de datos PostgreSQL activa (Docker Compose).
 * Se ejecuta manualmente con: mvnw test -Dspring.profiles.active=integration
 */
@SpringBootTest
@Disabled("Requiere PostgreSQL activo. Ejecutar solo con Docker Compose levantado.")
class InventarioApiApplicationTests {

    @Test
    void contextLoads() {
        // Verifica que el contexto de Spring arranca sin errores
    }
}
