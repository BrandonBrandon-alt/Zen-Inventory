package co.com.zenvory.inventario.branch.domain.model;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Branch {

    private Long id;
    private String name;
    private String address;
    private String phone;
    private Long managerId;

    @Builder.Default
    private Boolean active = true;

    private LocalDateTime createdAt;
}