package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

/**
 * Objeto de transferencia (DTO) para la respuesta de un inicio de sesión exitoso.
 * 
 * <p>Contiene el token de seguridad y el perfil básico del usuario autenticado
 * para que el frontend pueda gestionar el estado de la sesión y los permisos de vista.</p>
 * 
 * @param token Token JWT generado para la sesión.
 * @param tipo Esquema de autenticación (generalmente "Bearer").
 * @param email Correo electrónico del usuario.
 * @param nombre Nombre completo del usuario.
 * @param rol Nombre del rol asignado.
 * @param sucursalId ID de la sucursal de trabajo (puede ser null para administradores).
 * @param id Identificador único del usuario.
 */
public record LoginResponse(
        String token,
        String tipo,
        String email,
        String nombre,
        String rol,
        Long sucursalId,
        Long id) {

    /** Constructor de conveniencia: tipo siempre es "Bearer". */
    public LoginResponse(String token, String email, String nombre, String rol, Long sucursalId, Long id) {
        this(token, "Bearer", email, nombre, rol, sucursalId, id);
    }
}
