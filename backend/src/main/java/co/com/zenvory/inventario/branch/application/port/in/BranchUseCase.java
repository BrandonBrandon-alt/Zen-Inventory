package co.com.zenvory.inventario.branch.application.port.in;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de negocio para la gestión de sucursales.
 */
public interface BranchUseCase {

    /**
     * Recupera todas las sucursales registradas en el sistema.
     * 
     * @return Lista de modelos de dominio {@link Branch}.
     */
    List<Branch> getAllBranches();

    /**
     * Busca una sucursal por su identificador único.
     * 
     * @param id ID de la sucursal.
     * @return Modelo de la sucursal encontrada.
     * @throws co.com.zenvory.inventario.shared.domain.exception.ResourceNotFoundException Si no existe.
     */
    Branch getBranchById(Long id);

    /**
     * Registra una nueva sucursal con estado activo por defecto.
     * 
     * @param branch Datos de la sucursal de entrada.
     * @return La sucursal persistida con metadatos.
     */
    Branch createBranch(Branch branch);

    /**
     * Actualiza la información de una sucursal existente.
     * 
     * @param id ID de la sucursal a modificar.
     * @param branch Nuevos datos.
     * @return Modelo de la sucursal actualizada.
     */
    Branch updateBranch(Long id, Branch branch);

    /**
     * Realiza una eliminación lógica de la sucursal.
     * 
     * @param id ID de la sucursal a desactivar.
     */
    void deleteBranch(Long id);
}