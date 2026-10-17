package co.com.zenvory.inventario.auth.infrastructure.adapter.out.image;

import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("ImageIoAvatarProcessor")
class ImageIoAvatarProcessorTest {

    private final ImageIoAvatarProcessor processor = new ImageIoAvatarProcessor();

    private static byte[] image(int w, int h, String format, Color color, int type) throws IOException {
        BufferedImage img = new BufferedImage(w, h, type);
        Graphics2D g = img.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, w, h);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    private static BufferedImage decode(AvatarImage avatar) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(avatar.content()));
    }

    @Test
    @DisplayName("una imagen rectangular queda cuadrada de 256×256 en JPEG")
    void squareJpeg() throws IOException {
        AvatarImage result = processor.process(image(800, 400, "png", Color.RED, BufferedImage.TYPE_INT_RGB));
        BufferedImage out = decode(result);
        assertThat(result.contentType()).isEqualTo("image/jpeg");
        assertThat(out.getWidth()).isEqualTo(256);
        assertThat(out.getHeight()).isEqualTo(256);
    }

    @Test
    @DisplayName("recorta el centro: una franja azul lateral queda fuera")
    void centerCrop() throws IOException {
        BufferedImage img = new BufferedImage(600, 200, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, 600, 200);
        g.setColor(Color.RED);
        g.fillRect(200, 0, 200, 200); // el cuadrado central
        g.dispose();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bytes);

        BufferedImage out = decode(processor.process(bytes.toByteArray()));
        Color corner = new Color(out.getRGB(5, 5));
        assertThat(corner.getRed()).isGreaterThan(200);
        assertThat(corner.getBlue()).isLessThan(60);
    }

    @Test
    @DisplayName("la transparencia se aplana sobre blanco")
    void transparencyOnWhite() throws IOException {
        BufferedImage out = decode(processor.process(image(100, 100, "png", new Color(0, 0, 0, 0), BufferedImage.TYPE_INT_ARGB)));
        Color pixel = new Color(out.getRGB(128, 128));
        assertThat(pixel.getRed()).isGreaterThan(240);
        assertThat(pixel.getGreen()).isGreaterThan(240);
    }

    @Test
    @DisplayName("acepta JPEG y GIF además de PNG")
    void acceptsOtherFormats() throws IOException {
        assertThat(processor.process(image(50, 50, "jpeg", Color.GREEN, BufferedImage.TYPE_INT_RGB)).content()).isNotEmpty();
        assertThat(processor.process(image(50, 50, "gif", Color.GREEN, BufferedImage.TYPE_INT_RGB)).content()).isNotEmpty();
    }

    @Test
    @DisplayName("una imagen más pequeña que 256 se amplía sin fallar")
    void smallImage() throws IOException {
        assertThat(decode(processor.process(image(20, 20, "png", Color.RED, BufferedImage.TYPE_INT_RGB))).getWidth()).isEqualTo(256);
    }

    @Test
    @DisplayName("un archivo que no es imagen se rechaza aunque diga ser .png")
    void notAnImage() {
        assertThatThrownBy(() -> processor.process("<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("imagen válida");
    }

    @Test
    @DisplayName("un SVG o un BMP no son formatos admitidos")
    void unsupportedFormats() throws IOException {
        assertThatThrownBy(() -> processor.process("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> processor.process(image(10, 10, "bmp", Color.RED, BufferedImage.TYPE_INT_RGB)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("vacío o nulo piden seleccionar una imagen")
    void emptyInput() {
        assertThatThrownBy(() -> processor.process(new byte[0])).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> processor.process(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("una imagen con demasiados píxeles se rechaza sin decodificarla")
    void tooManyPixels() throws IOException {
        // 6000x6000 = 36 Mpx de un solo color: pesa muy poco en PNG pero decodificada ocuparía ~144 MB.
        byte[] huge = image(6000, 6000, "png", Color.WHITE, BufferedImage.TYPE_BYTE_BINARY);
        assertThatThrownBy(() -> processor.process(huge)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("megapíxeles");
    }
}
