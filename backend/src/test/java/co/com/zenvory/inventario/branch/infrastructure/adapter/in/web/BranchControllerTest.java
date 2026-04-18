package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.domain.exception.BranchNotFoundException;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto.BranchRequest;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests de la capa web para BranchController.
 * - @WebMvcTest levanta solo el slice de MVC (sin JPA, sin Services reales).
 * - @AutoConfigureMockMvc(addFilters = false) desactiva los filtros
 * JWT/Security
 * para poder testear el controlador de forma aislada.
 */
@WebMvcTest(BranchController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("BranchController — Tests de capa web")
class BranchControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @Autowired
        private ObjectMapper objectMapper;

        @MockitoBean
        private BranchUseCase branchUseCase;

        // Requeridos por JwtAuthenticationFilter que carga SecurityConfig en @WebMvcTest
        @MockitoBean
        private JpaUserRepository jpaUserRepository;

        @MockitoBean
        private JwtService jwtService;

        private Branch sampleBranch;

        @BeforeEach
        void setUp() {
                sampleBranch = Branch.builder()
                                .id(1L)
                                .name("Sucursal Norte")
                                .address("Calle 123 #45-67")
                                .phone("3001234567")
                                .active(true)
                                .createdAt(LocalDateTime.of(2024, 6, 1, 9, 0))
                                .build();
        }

        // ─── GET /api/branches ───────────────────────────────────────────────────

        @Test
        @DisplayName("GET /api/branches: retorna 200 con la lista de sucursales")
        void getAll_returns200WithList() throws Exception {
                when(branchUseCase.getAllBranches()).thenReturn(List.of(sampleBranch));

                mockMvc.perform(get("/api/branches"))
                                .andExpect(status().isOk())
                                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                                .andExpect(jsonPath("$.length()").value(1))
                                .andExpect(jsonPath("$[0].id").value(1))
                                .andExpect(jsonPath("$[0].nombre").value("Sucursal Norte"))
                                .andExpect(jsonPath("$[0].direccion").value("Calle 123 #45-67"))
                                .andExpect(jsonPath("$[0].telefono").value("3001234567"))
                                .andExpect(jsonPath("$[0].activa").value(true));
        }

        @Test
        @DisplayName("GET /api/branches: retorna 200 con lista vacía cuando no hay sucursales")
        void getAll_returns200WithEmptyList() throws Exception {
                when(branchUseCase.getAllBranches()).thenReturn(List.of());

                mockMvc.perform(get("/api/branches"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.length()").value(0));
        }

        // ─── GET /api/branches/{id} ──────────────────────────────────────────────

        @Test
        @DisplayName("GET /api/branches/{id}: retorna 200 con la sucursal encontrada")
        void getById_returns200WithBranch() throws Exception {
                when(branchUseCase.getBranchById(1L)).thenReturn(sampleBranch);

                mockMvc.perform(get("/api/branches/1"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(1))
                                .andExpect(jsonPath("$.nombre").value("Sucursal Norte"));
        }

        @Test
        @DisplayName("GET /api/branches/{id}: retorna 404 cuando el ID no existe")
        void getById_returns404WhenNotFound() throws Exception {
                when(branchUseCase.getBranchById(99L))
                                .thenThrow(new BranchNotFoundException(99L));

                mockMvc.perform(get("/api/branches/99"))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.message").value("Sucursal no encontrada con ID: 99"));
        }

        // ─── POST /api/branches ──────────────────────────────────────────────────

        @Test
        @DisplayName("POST /api/branches: retorna 201 con la sucursal creada")
        void create_returns201WithCreatedBranch() throws Exception {
                BranchRequest request = new BranchRequest("Sucursal Sur", "Carrera 80 #12-34", "3159876543", null);
                when(branchUseCase.createBranch(any(Branch.class))).thenReturn(sampleBranch);

                mockMvc.perform(post("/api/branches")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.id").value(1))
                                .andExpect(jsonPath("$.nombre").value("Sucursal Norte"));
        }

        @Test
        @DisplayName("POST /api/branches: pasa el nombre, dirección y teléfono del request al caso de uso")
        void create_passesDtoDataToUseCase() throws Exception {
                BranchRequest request = new BranchRequest("Nueva Sucursal", "Dirección Test", "3001111111", null);

                Branch expected = Branch.builder()
                                .id(5L)
                                .name("Nueva Sucursal")
                                .address("Dirección Test")
                                .phone("3001111111")
                                .active(true)
                                .build();

                when(branchUseCase.createBranch(any(Branch.class))).thenReturn(expected);

                mockMvc.perform(post("/api/branches")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isCreated())
                                .andExpect(jsonPath("$.nombre").value("Nueva Sucursal"))
                                .andExpect(jsonPath("$.direccion").value("Dirección Test"))
                                .andExpect(jsonPath("$.telefono").value("3001111111"));
        }
}
