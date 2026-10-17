package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.ProfileUseCase;
import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({ProfileController.class, AvatarController.class})
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ProfileController y AvatarController")
class ProfileControllerTest {

    private static final java.security.Principal ME = () -> "ana@z.co";

    @Autowired private MockMvc mockMvc;
    @MockitoBean private ProfileUseCase profile;
    @MockitoBean private JpaUserRepository jpaUserRepository;
    @MockitoBean private JwtService jwtService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder().id(7L).nombre("Ana").email("ana@z.co").passwordHash("HASH-SECRETO")
                .role(Role.builder().id(4L).nombre("SELLER").build()).sucursalId(1L).active(true)
                .avatarUpdatedAt(LocalDateTime.of(2026, 10, 1, 8, 0)).build();
    }

    @Test
    @DisplayName("GET /api/profile devuelve el perfil sin datos de credenciales")
    void getsProfile() throws Exception {
        when(profile.getProfile("ana@z.co")).thenReturn(user);
        mockMvc.perform(get("/api/profile").principal(ME))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Ana"))
                .andExpect(jsonPath("$.avatarActualizadoEn").value("2026-10-01T08:00:00"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("HASH-SECRETO"))));
    }

    @Test
    @DisplayName("PUT /api/profile cambia el nombre")
    void updatesName() throws Exception {
        when(profile.updateName(eq("ana@z.co"), eq("Ana Pérez"))).thenReturn(user);
        mockMvc.perform(put("/api/profile").principal(ME).contentType(MediaType.APPLICATION_JSON).content("{\"nombre\":\"Ana Pérez\"}"))
                .andExpect(status().isOk());
        verify(profile).updateName("ana@z.co", "Ana Pérez");
    }

    @Test
    @DisplayName("PUT /api/profile con nombre vacío responde 400")
    void blankNameIs400() throws Exception {
        mockMvc.perform(put("/api/profile").principal(ME).contentType(MediaType.APPLICATION_JSON).content("{\"nombre\":\" \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/profile/password cambia la contraseña y responde 204")
    void changesPassword() throws Exception {
        mockMvc.perform(put("/api/profile/password").principal(ME).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contrasenaActual\":\"secreto1\",\"contrasenaNueva\":\"nuevaClave\"}"))
                .andExpect(status().isNoContent());
        verify(profile).changePassword("ana@z.co", "secreto1", "nuevaClave");
    }

    @Test
    @DisplayName("una contraseña nueva de menos de 6 caracteres responde 400")
    void shortPasswordIs400() throws Exception {
        mockMvc.perform(put("/api/profile/password").principal(ME).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contrasenaActual\":\"secreto1\",\"contrasenaNueva\":\"123\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/profile/avatar recibe el archivo y lo entrega al caso de uso")
    void uploadsAvatar() throws Exception {
        byte[] bytes = {1, 2, 3};
        when(profile.changeAvatar(eq("ana@z.co"), any())).thenReturn(user);
        mockMvc.perform(multipart("/api/profile/avatar").file(new MockMultipartFile("archivo", "yo.png", "image/png", bytes))
                        .with(r -> { r.setMethod("PUT"); return r; }).principal(ME))
                .andExpect(status().isOk());
        verify(profile).changeAvatar("ana@z.co", bytes);
    }

    @Test
    @DisplayName("DELETE /api/profile/avatar quita la foto")
    void removesAvatar() throws Exception {
        when(profile.removeAvatar("ana@z.co")).thenReturn(user);
        mockMvc.perform(delete("/api/profile/avatar").principal(ME)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/avatars/{id} sirve la imagen con su tipo y caché privado")
    void servesAvatar() throws Exception {
        when(profile.getAvatar(7L)).thenReturn(Optional.of(new AvatarImage(new byte[] {5, 6}, "image/jpeg")));
        mockMvc.perform(get("/api/avatars/7"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes(new byte[] {5, 6}));
    }

    @Test
    @DisplayName("GET /api/avatars/{id} sin foto responde 404")
    void noAvatarIs404() throws Exception {
        when(profile.getAvatar(9L)).thenReturn(Optional.empty());
        mockMvc.perform(get("/api/avatars/9")).andExpect(status().isNotFound());
    }
}
