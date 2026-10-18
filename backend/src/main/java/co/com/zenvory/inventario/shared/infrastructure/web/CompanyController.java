package co.com.zenvory.inventario.shared.infrastructure.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Datos de la empresa que se imprimen en la factura de venta (nombre, NIT, dirección, teléfono, prefijo y pie).
 * Los define cada despliegue en {@code app.company.*} (variables {@code COMPANY_*}); no son secretos, así que los
 * puede leer cualquier usuario con sesión.
 */
@RestController
@RequestMapping("/api/v1/company")
public class CompanyController {

    /** Lo que ve el frontend; los textos vacíos significan "no configurado". */
    public record CompanyResponse(String name, String taxId, String address, String phone, String invoicePrefix, String invoiceFooter) {}

    private final CompanyResponse company;

    public CompanyController(
            @Value("${app.company.name:Zen Inventory}") String name,
            @Value("${app.company.tax-id:}") String taxId,
            @Value("${app.company.address:}") String address,
            @Value("${app.company.phone:}") String phone,
            @Value("${app.company.invoice-prefix:FV}") String invoicePrefix,
            @Value("${app.company.footer:}") String footer) {
        this.company = new CompanyResponse(name.trim(), taxId.trim(), address.trim(), phone.trim(), invoicePrefix.trim(), footer.trim());
    }

    @GetMapping
    public ResponseEntity<CompanyResponse> get() {
        return ResponseEntity.ok(company);
    }
}
