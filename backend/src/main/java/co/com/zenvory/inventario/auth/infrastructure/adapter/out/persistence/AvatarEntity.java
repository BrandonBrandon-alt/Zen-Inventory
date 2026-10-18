package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Foto de perfil de un usuario ({@code usuario_avatar}); la clave es el id del usuario. */
@Entity
@Table(name = "usuario_avatar")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AvatarEntity {

    @Id
    @Column(name = "usuario_id")
    private Long userId;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "contenido", nullable = false)
    private byte[] content;

    @Column(name = "tipo_contenido", nullable = false, length = 50)
    private String contentType;
}
