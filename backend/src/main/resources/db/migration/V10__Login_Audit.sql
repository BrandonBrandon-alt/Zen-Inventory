-- Auditoría de inicios de sesión: cada intento, exitoso o no, con el correo que se escribió, la persona si existe,
-- el resultado y desde qué IP. Sirve para ver accesos y detectar intentos sobre cuentas ajenas.

CREATE TABLE IF NOT EXISTS public.inicio_sesion
(
    id bigserial NOT NULL,
    fecha timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email character varying(255) NOT NULL,
    usuario_id bigint,
    resultado character varying(30) NOT NULL,
    ip character varying(64),
    CONSTRAINT inicio_sesion_pkey PRIMARY KEY (id),
    CONSTRAINT inicio_sesion_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario (id),
    CONSTRAINT inicio_sesion_resultado_check CHECK (resultado IN ('EXITOSO', 'CREDENCIALES_INVALIDAS', 'CUENTA_DESACTIVADA', 'BLOQUEADO'))
);

CREATE INDEX IF NOT EXISTS idx_inicio_sesion_fecha ON public.inicio_sesion (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_inicio_sesion_email ON public.inicio_sesion (email);
