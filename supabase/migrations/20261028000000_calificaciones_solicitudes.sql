-- Calificación que deja el solicitante cuando un técnico finaliza su solicitud.
-- Una sola por solicitud y no editable: si la omite queda registrada como omitida
-- para no volver a pedírsela.
CREATE TABLE IF NOT EXISTS public.calificaciones (
  solicitud_id UUID PRIMARY KEY REFERENCES public.solicitudes(id) ON DELETE CASCADE,
  puntaje SMALLINT CHECK (puntaje BETWEEN 1 AND 5),
  comentario TEXT CHECK (comentario IS NULL OR char_length(comentario) BETWEEN 1 AND 500),
  omitida BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calificaciones_puntaje_u_omitida CHECK (
    (omitida AND puntaje IS NULL AND comentario IS NULL)
    OR (NOT omitida AND puntaje IS NOT NULL)
  )
);

ALTER TABLE public.calificaciones ENABLE ROW LEVEL SECURITY;

-- Solo lectura desde el cliente; se escribe únicamente con calificar_solicitud().
REVOKE ALL ON public.calificaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.calificaciones TO authenticated;
GRANT ALL ON public.calificaciones TO service_role;

DROP POLICY IF EXISTS "Solicitante y administradores ven calificaciones" ON public.calificaciones;
CREATE POLICY "Solicitante y administradores ven calificaciones"
ON public.calificaciones FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1 FROM public.solicitudes s
    WHERE s.id = calificaciones.solicitud_id AND s.usuario_id = auth.uid()
  )
);

-- Solicitudes del usuario actual que todavía puede calificar: finalizadas en los
-- últimos 15 días, sin calificar ni omitir, y que no se finalizó él mismo.
CREATE OR REPLACE FUNCTION public.solicitudes_por_calificar()
RETURNS TABLE (
  id UUID,
  motivo TEXT,
  fecha_finalizacion TIMESTAMPTZ,
  responsable_nombre TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.motivo,
    s.fecha_finalizacion,
    NULLIF(concat_ws(' ', p.nombre, p.apellido), '')
  FROM public.solicitudes s
  LEFT JOIN public.profiles p ON p.id = s.asignado_a
  WHERE s.usuario_id = auth.uid()
    AND s.estado = 'finalizado'
    AND s.fecha_finalizacion >= now() - interval '15 days'
    AND s.asignado_a IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.calificaciones c WHERE c.solicitud_id = s.id)
  ORDER BY s.fecha_finalizacion DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.solicitudes_por_calificar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitudes_por_calificar() TO authenticated;

CREATE OR REPLACE FUNCTION public.calificar_solicitud(
  _solicitud_id UUID,
  _puntaje SMALLINT,
  _comentario TEXT,
  _omitir BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comentario_limpio TEXT := NULLIF(btrim(_comentario), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.solicitudes_por_calificar() pc WHERE pc.id = _solicitud_id
  ) THEN
    RAISE EXCEPTION 'Esta solicitud ya no se puede calificar'
      USING ERRCODE = '42501';
  END IF;

  IF NOT _omitir AND (_puntaje IS NULL OR _puntaje NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'El puntaje debe estar entre 1 y 5'
      USING ERRCODE = '23514';
  END IF;

  IF char_length(comentario_limpio) > 500 THEN
    RAISE EXCEPTION 'El comentario no puede superar los 500 caracteres'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.calificaciones (solicitud_id, puntaje, comentario, omitida)
  VALUES (
    _solicitud_id,
    CASE WHEN _omitir THEN NULL ELSE _puntaje END,
    CASE WHEN _omitir THEN NULL ELSE comentario_limpio END,
    _omitir
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calificar_solicitud(UUID, SMALLINT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calificar_solicitud(UUID, SMALLINT, TEXT, BOOLEAN) TO authenticated;
