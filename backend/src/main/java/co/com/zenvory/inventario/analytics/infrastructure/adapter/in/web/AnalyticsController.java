package co.com.zenvory.inventario.analytics.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.analytics.application.port.in.AnalyticsUseCase;
import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.DashboardAnalyticsResponse;
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

@RestController
@RequestMapping("/api/v1/analytics")
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AnalyticsController {

    private final AnalyticsUseCase analyticsUseCase;
    private final UserRepositoryPort userRepositoryPort;

    public AnalyticsController(AnalyticsUseCase analyticsUseCase, UserRepositoryPort userRepositoryPort) {
        this.analyticsUseCase = analyticsUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    /**
     * Resolves the branchId scope:
     *  - ADMIN → null (queries all branches)
     *  - MANAGER → their own sucursalId (queries only their branch)
     */
    private Long resolveBranchScope() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = userRepositoryPort.findByEmail(auth.getName()).orElseThrow();
        if ("MANAGER".equals(user.getRole().getNombre())) {
            return user.getSucursalId();
        }
        return null; // ADMIN sees everything
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardAnalyticsResponse> getDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getDashboardData(startDate, endDate, resolveBranchScope()));
    }

    @GetMapping("/top-products")
    public ResponseEntity<List<TopSellingProduct>> getTopSellingProducts(
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        List<TopSellingProduct> products = analyticsUseCase.getTopSellingProducts(limit, startDate, endDate, resolveBranchScope());
        return ResponseEntity.ok(products);
    }

    @GetMapping("/valuations")
    public ResponseEntity<List<BranchValuation>> getBranchValuations() {
        List<BranchValuation> valuations = analyticsUseCase.getBranchValuations(resolveBranchScope());
        return ResponseEntity.ok(valuations);
    }

    @GetMapping("/global-summary")
    public ResponseEntity<GlobalSummary> getGlobalSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getGlobalSummary(startDate, endDate, resolveBranchScope()));
    }

    @GetMapping("/branch-performance")
    public ResponseEntity<List<BranchPerformance>> getBranchPerformance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getBranchPerformance(startDate, endDate, resolveBranchScope()));
    }

    @GetMapping("/sales-trend")
    public ResponseEntity<List<SalesTrend>> getSalesTrend(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        return ResponseEntity.ok(analyticsUseCase.getSalesTrend(startDate, endDate, resolveBranchScope()));
    }
}
