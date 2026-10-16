package co.com.zenvory.inventario.shared.infrastructure.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Servicio compartido para generación y validación de tokens JWT.
 *
 * <p>Usa HMAC-SHA256 (HS256) con la clave configurada en {@code security.jwt.secret}.
 * La clave se inyecta desde variables de entorno en Docker (no hardcodeada).</p>
 */
@Service
public class JwtService {

    private static final String USER_ID_CLAIM = "uid";

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
     * Genera un token JWT con el email como subject y el id del usuario en el claim {@code uid}.
     *
     * <p>El rol y la sucursal no viajan en el token: se leen de la base de datos en cada petición, así que
     * un cambio de rol o de sucursal rige de inmediato. El {@code uid} ata el token a la persona y no solo al
     * correo: si el correo se reasigna a otra cuenta, los tokens anteriores dejan de servir.</p>
     *
     * @param userId identificador del usuario
     * @param email  correo del usuario (subject)
     * @return token JWT firmado con HS256
     */
    public String generateToken(Long userId, String email) {
        return Jwts.builder()
                .subject(email)
                .claim(USER_ID_CLAIM, userId)
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

    /** Id del usuario al que pertenece el token, o {@code null} si el token no lo trae (emitido antes del claim). */
    public Long extractUserId(String token) {
        return parseClaims(token).get(USER_ID_CLAIM, Long.class);
    }

    /** Resultado de inspeccionar un token: permite distinguir "venció" de "no es válido". */
    public enum TokenStatus { VALID, EXPIRED, INVALID }

    public TokenStatus inspect(String token) {
        try {
            parseClaims(token);
            return TokenStatus.VALID;
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            return TokenStatus.EXPIRED;
        } catch (Exception e) {
            return TokenStatus.INVALID;
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
