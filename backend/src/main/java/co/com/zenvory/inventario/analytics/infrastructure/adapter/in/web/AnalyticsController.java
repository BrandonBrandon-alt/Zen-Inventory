    package co.com.zenvory.inventario.analytics.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.analytics.application.port.in.AnalyticsUseCase;
import co.com.zenvory.inventario.analytics.domain.model.*;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Adaptador de entrada (Primary Adapter) para la API REST de analítica.
 * 
 * <p>Expone endpoints para visualizar indicadores de negocio. Implementa lógica de 
 * control de acceso basada en el rol del usuario (ADMIN ve todo, MANAGER solo su sucursal).</p>
 */
@RestController
@RequestMapping("/api/v1/analytics")
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
public class AnalyticsController {

    private final AnalyticsUseCase analyticsUseCase;
    private final UserRepositoryPort userRepositoryPort;

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param analyticsUseCase Puerto de entrada de la lógica de analítica.
     * @param userRepositoryPort Puerto para consultar información de seguridad del usuario.
     */
    public AnalyticsController(AnalyticsUseCase analyticsUseCase, UserRepositoryPort userRepositoryPort) {
        this.analyticsUseCase = analyticsUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    /**
     * Determina el alcance de la consulta según el rol del usuario autenticado.
     * 
     * <p>Regla de negocio:
     * <ul>
     *   <li>ADMIN (Administrador Global) → Retorna null para consultar todas las sucursales.</li>
     *   <li>MANAGER (Gerente de Sucursal) → Retorna su sucursalId asignada para restringir los datos.</li>
     * </ul>
     * </p>
     * 
     * @return El ID de la sucursal a filtrar o null si tiene acceso global.
     */
    private Long resolveBranchScope() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = userRepositoryPort.findByEmail(auth.getName()).orElseThrow();
        String roleName = user.getRole().getNombre();
        
        if ("MANAGER".equals(roleName) || "OPERADOR_INVENTARIO".equals(roleName)) {
            return user.getSucursalId();
        }
        return null; // ADMIN ve todo el sistema
    }

    /**
     * Obtiene el conjunto completo de datos para el tablero de control.
     * 
     * @param startDate Fecha inicial opcional.
     * @param endDate Fecha final opcional.
     * @return Respuesta con indicadores globales, tendencias y rankings.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<DashboardAnalyticsResponse> getDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getDashboardData(startDate, endDate, resolveBranchScope()));
    }

    /**
     * Retorna el ranking de los productos con mayor volumen de ventas.
     * 
     * @param limit Número de registros a retornar (por defecto 5).
     * @param startDate Filtro de fecha inicio.
     * @param endDate Filtro de fecha fin.
     * @return Lista de productos top vendidos.
     */
    @GetMapping("/top-products")
    public ResponseEntity<List<TopSellingProduct>> getTopSellingProducts(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<TopSellingProduct> products = analyticsUseCase.getTopSellingProducts(limit, startDate, endDate, resolveBranchScope());
        return ResponseEntity.ok(products);
    }

    /**
     * Entrega la valoración financiera del inventario (costo acumulado).
     * 
     * @return Datos de valoración por sucursal permitida.
     */
    @GetMapping("/valuations")
    public ResponseEntity<List<BranchValuation>> getBranchValuations() {
        List<BranchValuation> valuations = analyticsUseCase.getBranchValuations(resolveBranchScope());
        return ResponseEntity.ok(valuations);
    }

    /**
     * Retorna un resumen de métricas clave (totales netos).
     * 
     * @param startDate Filtro de fecha inicio.
     * @param endDate Filtro de fecha fin.
     * @return Resumen global de métricas principales.
     */
    @GetMapping("/global-summary")
    public ResponseEntity<GlobalSummary> getGlobalSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getGlobalSummary(startDate, endDate, resolveBranchScope()));
    }

    /**
     * Compara el desempeño operativo entre las sucursales accesibles.
     * 
     * @param startDate Filtro de fecha inicio.
     * @param endDate Filtro de fecha fin.
     * @return Lista de métricas de rendimiento sucursal por sucursal.
     */
    @GetMapping("/branch-performance")
    public ResponseEntity<List<BranchPerformance>> getBranchPerformance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getBranchPerformance(startDate, endDate, resolveBranchScope()));
    }

    /**
     * Proporciona la curva de tendencia de ventas por periodo.
     */
    @GetMapping("/sales-trend")
    public ResponseEntity<List<SalesTrend>> getSalesTrend(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getSalesTrend(startDate, endDate, resolveBranchScope()));
    }

    /**
     * Recupera la comparativa de ventas mensuales (últimos 6 meses).
     */
    @GetMapping("/monthly-sales")
    public ResponseEntity<List<MonthlySales>> getMonthlySales() {
        return ResponseEntity.ok(analyticsUseCase.getMonthlySales(resolveBranchScope()));
    }

    /**
     * Calcula la rotación de inventario y detecta productos sin movimiento.
     */
    @GetMapping("/inventory-rotation")
    public ResponseEntity<List<InventoryRotation>> getInventoryRotation() {
        return ResponseEntity.ok(analyticsUseCase.getInventoryRotation(resolveBranchScope()));
    }

    /**
     * Identifica productos que requieren reabastecimiento proactivo.
     */
    @GetMapping("/replenishment-insights")
    public ResponseEntity<List<ReplenishmentInsight>> getReplenishmentInsights() {
        return ResponseEntity.ok(analyticsUseCase.getReplenishmentInsights(resolveBranchScope()));
    }

    /**
     * Calcula el impacto monetario y operativo de los traslados activos.
     */
    @GetMapping("/transfers-impact")
    public ResponseEntity<TransferImpact> getTransferImpact() {
        return ResponseEntity.ok(analyticsUseCase.getTransferImpact(resolveBranchScope()));
    }
}

