package co.com.zenvory.inventario.auth.application.port.in;

import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.domain.model.Role;
import java.util.List;

/**
 * Puerto de entrada (Input Port) para la gestión administrativa de usuarios y roles.
 */
public interface UserUseCase {

    /**
     * Recupera el listado completo de usuarios registrados en el sistema.
     * 
     * @return Lista de modelos de dominio {@link User}.
     */
    List<User> getAllUsers();

    /**
     * Busca un usuario por su identificador primario.
     * 
     * @param id ID del usuario.
     * @return El usuario encontrado.
     * @throws co.com.zenvory.inventario.shared.domain.exception.ResourceNotFoundException Si no existe.
     */
    User getUserById(Long id);

    /**
     * Crea un nuevo usuario en el sistema, cifrando su contraseña.
     * 
     * @param user Datos básicos del usuario (nombre, email, rol, sucursal).
     * @param plainPassword Contraseña en texto plano para ser procesada.
     * @return El usuario persistido.
     */
    User createUser(User user, String plainPassword);

    /**
     * Actualiza la información de un usuario existente.
     * 
     * @param id ID del usuario a modificar.
     * @param user Nuevos datos del usuario.
     * @param plainPassword Nueva contraseña (opcional, null si no se cambia).
     * @return El usuario actualizado.
     */
    User updateUser(Long id, User user, String plainPassword);

    /**
     * Desactiva lógicamente a un usuario.
     * 
     * @param id ID del usuario a desactivar.
     */
    void deactivateUser(Long id);

    /**
     * Obtiene el listado de roles de usuario disponibles en el sistema.
     * 
     * @return Lista de objetos de dominio {@link Role}.
     */
    List<Role> getAllRoles();
}

