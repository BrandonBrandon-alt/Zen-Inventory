package co.com.zenvory.inventario.auth.application.port.out;

import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) que define el contrato para la persistencia de usuarios y roles.
 * 
 * <p>Desacopla la lógica de negocio de la implementación específica de la base de datos.</p>
 */
public interface UserRepositoryPort {

    /**
     * Recupera un usuario basado en su correo electrónico único.
     * 
     * @param email Email a buscar.
     * @return El usuario si existe, de lo contrario un {@link Optional} vacío.
     */
    Optional<User> findByEmail(String email);

    /**
     * Recupera un usuario por su identificador único.
     * 
     * @param id Identificador primario.
     * @return El usuario encontrado.
     */
    Optional<User> findById(Long id);

    /**
     * Obtiene la lista completa de usuarios persistidos.
     * 
     * @return Lista de todos los usuarios.
     */
    List<User> findAll();

    /**
     * Guarda o actualiza un usuario en el almacén de datos.
     * 
     * @param user Modelo de dominio del usuario a persistir.
     * @return El usuario guardado.
     */
    User save(User user);

    /**
     * Obtiene todos los roles definidos en el sistema.
     * 
     * @return Lista de roles.
     */
    List<Role> findAllRoles();

    /**
     * Busca un rol por su identificador.
     * 
     * @param id ID del rol.
     * @return Rol encontrado wrapped en Optional.
     */
    Optional<Role> findRoleById(Long id);
}

