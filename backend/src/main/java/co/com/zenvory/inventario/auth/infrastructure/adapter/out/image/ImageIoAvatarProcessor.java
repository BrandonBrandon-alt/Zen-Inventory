package co.com.zenvory.inventario.auth.infrastructure.adapter.out.image;

import co.com.zenvory.inventario.auth.application.port.out.AvatarProcessorPort;
import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Set;

/**
 * Convierte la imagen subida en una foto de perfil de 256×256 en JPEG.
 *
 * <p>Solo acepta JPEG, PNG y GIF, y lo comprueba leyendo la imagen (no por la extensión ni el tipo que declare el
 * cliente). Antes de decodificarla revisa sus dimensiones, para que una imagen diminuta en bytes pero enorme en
 * píxeles no agote la memoria. El recorte es centrado y cuadrado; la transparencia se aplana sobre blanco.</p>
 */
@Component
public class ImageIoAvatarProcessor implements AvatarProcessorPort {

    static final int SIZE = 256;
    static final long MAX_PIXELS = 25_000_000L;
    private static final Set<String> FORMATS = Set.of("jpeg", "png", "gif");
    private static final float QUALITY = 0.85f;
    static final String CONTENT_TYPE = "image/jpeg";

    @Override
    public AvatarImage process(byte[] original) {
        if (original == null || original.length == 0) {
            throw new IllegalArgumentException("Selecciona una imagen.");
        }
        BufferedImage source = decode(original);
        BufferedImage square = cropAndScale(source);
        return new AvatarImage(encode(square), CONTENT_TYPE);
    }

    private BufferedImage decode(byte[] bytes) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = stream == null ? null : ImageIO.getImageReaders(stream);
            if (readers == null || !readers.hasNext()) {
                throw invalid();
            }
            ImageReader reader = readers.next();
            try {
                if (!FORMATS.contains(reader.getFormatName().toLowerCase())) {
                    throw invalid();
                }
                reader.setInput(stream, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels > MAX_PIXELS) {
                    throw new IllegalArgumentException("La imagen es demasiado grande en píxeles; usa una de menos de 25 megapíxeles.");
                }
                return reader.read(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof IllegalArgumentException iae) {
                throw iae;
            }
            throw invalid();
        }
    }

    private BufferedImage cropAndScale(BufferedImage source) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        BufferedImage target = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, SIZE, SIZE);
            g.drawImage(source, 0, 0, SIZE, SIZE, x, y, x + side, y + side, null);
        } finally {
            g.dispose();
        }
        return target;
    }

    private byte[] encode(BufferedImage image) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             MemoryCacheImageOutputStream stream = new MemoryCacheImageOutputStream(out)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(QUALITY);
            writer.setOutput(stream);
            writer.write(null, new IIOImage(image, null, null), param);
            stream.flush();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo codificar la foto de perfil.", e);
        } finally {
            writer.dispose();
        }
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("El archivo no es una imagen válida. Usa una foto JPG, PNG o GIF.");
    }
}
