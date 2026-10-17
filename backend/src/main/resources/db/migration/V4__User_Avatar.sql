-- Foto de perfil. La imagen (ya reducida a 256x256 por el backend, unos pocos KB) vive en su propia tabla para que
-- los listados de usuarios no arrastren los bytes; usuario.avatar_actualizado_en indica si hay foto y sirve de versión
-- para que el navegador vuelva a pedirla cuando cambia.
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS avatar_actualizado_en timestamp without time zone;

CREATE TABLE IF NOT EXISTS public.usuario_avatar
(
    usuario_id bigint NOT NULL,
    contenido bytea NOT NULL,
    tipo_contenido character varying(50) NOT NULL,
    CONSTRAINT usuario_avatar_pkey PRIMARY KEY (usuario_id),
    CONSTRAINT usuario_avatar_usuario_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario (id) ON DELETE CASCADE
);
