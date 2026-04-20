package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "detalles_devolucion_solicitud")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReturnRequestDetailEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "solicitud_id")
    private ReturnRequestEntity request;
    
    @Column(name = "producto_id", nullable = false)
    private Long productId;
    
    @Column(nullable = false)
    private Integer cantidad;
    
    @Column(name = "motivo_especifico")
    private String motivoEspecifico;
    
    @Column(name = "precio_unidad_venta", nullable = false)
    private BigDecimal precioUnidadVenta;
}
