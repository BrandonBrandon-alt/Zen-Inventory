package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.ProfileUseCase;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.ChangePasswordRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.UpdateProfileRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.Principal;

/**
 * Cuenta propia: cualquier usuario autenticado, sea cual sea su rol, gestiona su nombre, su contraseña y su foto.
 * Nada recibe un id de usuario: siempre se actúa sobre quien hace la petición.
 */
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileUseCase profile;

    public ProfileController(ProfileUseCase profile) {
        this.profile = profile;
    }

    @GetMapping
    public ResponseEntity<UserResponse> get(Principal principal) {
        return ResponseEntity.ok(UserResponse.from(profile.getProfile(principal.getName())));
    }

    @PutMapping
    public ResponseEntity<UserResponse> update(@Valid @RequestBody UpdateProfileRequest request, Principal principal) {
        return ResponseEntity.ok(UserResponse.from(profile.updateName(principal.getName(), request.nombre())));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request, Principal principal) {
        profile.changePassword(principal.getName(), request.contrasenaActual(), request.contrasenaNueva());
        return ResponseEntity.noContent().build();
    }

    /** Sube la foto de perfil como {@code multipart/form-data} en el campo {@code archivo}. */
    @PutMapping(value = "/avatar", consumes = "multipart/form-data")
    public ResponseEntity<UserResponse> uploadAvatar(@RequestParam("archivo") MultipartFile file, Principal principal) throws IOException {
        return ResponseEntity.ok(UserResponse.from(profile.changeAvatar(principal.getName(), file.getBytes())));
    }

    @DeleteMapping("/avatar")
    public ResponseEntity<UserResponse> removeAvatar(Principal principal) {
        return ResponseEntity.ok(UserResponse.from(profile.removeAvatar(principal.getName())));
    }
}
