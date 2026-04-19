package co.com.zenvory.inventario.shared.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

/**
 * Servicio compartido para generación y validación de tokens JWT.
 *
 * <p>Usa HMAC-SHA256 (HS256) con la clave configurada en {@code security.jwt.secret}.
 * La clave se inyecta desde variables de entorno en Docker (no hardcodeada).</p>
 */
@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.expiration:86400000}") long expirationMs) {
        // Derivamos la clave desde el string configurado
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * Genera un token JWT con el email como subject y el rol como claim adicional.
     *
     * @param email     identificador único del usuario
     * @param rol         nombre del rol (ADMIN, MANAGER, OPERADOR_INVENTARIO)
     * @param sucursalId ID de la sucursal asignada (puede ser null para ADMIN)
     * @return token JWT firmado con HS256
     */
    public String generateToken(String email, String rol, Long sucursalId) {
        return Jwts.builder()
                .subject(email)
                .claims(Map.of(
                        "rol", rol,
                        "sucursalId", sucursalId != null ? sucursalId : ""
                ))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Extrae el email (subject) del token.
     * @throws io.jsonwebtoken.JwtException si el token es inválido o expiró
     */
    public String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    /**
     * Verifica si el token es válido y no ha expirado.
     */
    public boolean isTokenValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return !claims.getExpiration().before(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
