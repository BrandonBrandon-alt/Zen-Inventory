package co.com.zenvory.inventario.branch.application.port.out;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) que define el contrato de persistencia para las sucursales.
 */
public interface BranchRepositoryPort {

    /**
     * Recupera todas las sucursales del almacenamiento.
     * 
     * @return Lista de sucursales.
     */
    List<Branch> findAll();

    /**
     * Busca una sucursal por su identificador único.
     * 
     * @param id Identificador primario.
     * @return {@link Optional} que contiene la sucursal si existe.
     */
    Optional<Branch> findById(Long id);

    /**
     * Persiste o actualiza los datos de una sucursal.
     * 
     * @param branch Modelo de dominio.
     * @return La sucursal guardada.
     */
    Branch save(Branch branch);

    /**
     * Elimina el registro de la sucursal del sistema.
     * 
     * @param id ID de la sucursal a eliminar.
     */
    void deleteById(Long id);
}