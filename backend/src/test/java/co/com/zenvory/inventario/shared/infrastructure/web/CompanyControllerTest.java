package co.com.zenvory.inventario.shared.infrastructure.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("CompanyController — datos de la factura")
class CompanyControllerTest {

    @Test
    @DisplayName("devuelve los datos configurados, sin espacios sobrantes")
    void returnsConfiguredData() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(
                new CompanyController(" Ferretería Zen S.A.S. ", "900.123.456-1", " Cra 7 # 12-34 ", "604 444 0000", "FV", "Gracias")).build();

        mvc.perform(get("/api/v1/company"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ferretería Zen S.A.S."))
                .andExpect(jsonPath("$.taxId").value("900.123.456-1"))
                .andExpect(jsonPath("$.address").value("Cra 7 # 12-34"))
                .andExpect(jsonPath("$.invoicePrefix").value("FV"));
    }

    @Test
    @DisplayName("lo no configurado llega como texto vacío (el frontend no lo imprime)")
    void unsetValuesAreEmpty() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new CompanyController("Zen Inventory", "", "", "", "FV", "")).build();

        mvc.perform(get("/api/v1/company"))
                .andExpect(jsonPath("$.taxId").value(""))
                .andExpect(jsonPath("$.phone").value(""));
    }
}
