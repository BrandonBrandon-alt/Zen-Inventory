package co.com.zenvory.inventario.auth.application.port.out;

import co.com.zenvory.inventario.auth.domain.model.AvatarImage;

/** Puerto de salida que convierte una imagen subida por el usuario en una foto de perfil estándar. */
public interface AvatarProcessorPort {

    /**
     * Valida la imagen subida y la devuelve recortada a cuadrado y reducida.
     *
     * @throws IllegalArgumentException Si el archivo no es una imagen admitida o es demasiado grande.
     */
    AvatarImage process(byte[] original);
}
