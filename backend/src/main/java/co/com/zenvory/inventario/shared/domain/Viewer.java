package co.com.zenvory.inventario.shared.domain;

/**
 * Quién mira una lista, en lo que importa para decidir si algo «le toca»: si es administrador, si tiene gerencia
 * (ADMIN o MANAGER), si opera inventario (ADMIN, MANAGER u OPERADOR_INVENTARIO) y su sucursal (el ADMIN puede no tener; igual actúa sobre todas).
 */
public record Viewer(boolean admin, boolean manager, boolean operational, Long branchId) {
}
