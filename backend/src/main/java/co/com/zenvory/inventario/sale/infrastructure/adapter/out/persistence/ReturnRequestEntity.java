package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "solicitudes_devolucion")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReturnRequestEntity {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "venta_id", nullable = false)
    private Long ventaId;
    
    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;
    
    @Column(name = "solicitante_id", nullable = false)
    private Long solicitanteId;
    
    @Column(name = "aprobador_id")
    private Long aprobadorId;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReturnRequestStatus estado;
    
    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime fechaSolicitud;
    
    @Column(name = "fecha_procesamiento")
    private LocalDateTime fechaProcesamiento;
    
    @Column(name = "motivo_general", nullable = false)
    private String motivoGeneral;
    
    @Column(name = "comentario_aprobador")
    private String comentarioAprobador;
    
    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReturnRequestDetailEntity> details;
}
