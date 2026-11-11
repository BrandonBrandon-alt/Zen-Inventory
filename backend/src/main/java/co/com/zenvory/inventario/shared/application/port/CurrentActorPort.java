package co.com.zenvory.inventario.shared.application.port;

/** Quién está haciendo la operación actual, para dejarlo registrado (auditoría). */
public interface CurrentActorPort {

    /** Sin sesión (procesos internos, datos de demostración) devuelve un actor sin id llamado «Sistema». */
    Actor current();

    record Actor(Long id, String name) {
        public static final Actor SYSTEM = new Actor(null, "Sistema");
    }
}
