package co.com.zenvory.inventario.auth.domain.model;

/**
 * Foto de perfil ya procesada (recortada y reducida), lista para guardarse o servirse.
 *
 * @param content Bytes de la imagen.
 * @param contentType Tipo MIME de {@code content} (p. ej. {@code image/jpeg}).
 */
public record AvatarImage(byte[] content, String contentType) {}
