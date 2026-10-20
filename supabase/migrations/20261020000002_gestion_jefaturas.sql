CREATE OR REPLACE FUNCTION public.resolver_solicitud_jefatura(
  _profile_id UUID,
  _aprobar BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perfil_objetivo public.profiles%ROWTYPE;
  unidad_activa UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Solo un administrador puede resolver solicitudes de jefatura'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO perfil_objetivo
  FROM public.profiles
  WHERE id = _profile_id
  FOR UPDATE;

  IF NOT FOUND OR perfil_objetivo.solicitud_jefe IS DISTINCT FROM 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud de jefatura ya no está pendiente'
      USING ERRCODE = 'P0002';
  END IF;

  IF _aprobar THEN
    SELECT id
    INTO unidad_activa
    FROM public.unidades
    WHERE id = perfil_objetivo.unidad_id AND activo
    FOR UPDATE;

    IF unidad_activa IS NULL THEN
      RAISE EXCEPTION 'La persona debe pertenecer a una unidad activa para ser jefa'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.profiles
    SET es_jefe = false
    WHERE unidad_id = perfil_objetivo.unidad_id
      AND es_jefe
      AND id <> perfil_objetivo.id;

    UPDATE public.profiles
    SET es_jefe = true, solicitud_jefe = NULL
    WHERE id = perfil_objetivo.id;
  ELSE
    UPDATE public.profiles
    SET solicitud_jefe = 'rechazada'
    WHERE id = perfil_objetivo.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resumen_unidades()
RETURNS TABLE (unidad_id UUID, usuarios BIGINT, tickets BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el resumen del organigrama'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    unidad.id,
    count(DISTINCT perfil.id),
    count(DISTINCT solicitud.id)
  FROM public.unidades AS unidad
  LEFT JOIN public.profiles AS perfil ON perfil.unidad_id = unidad.id
  LEFT JOIN public.solicitudes AS solicitud ON solicitud.unidad_id = unidad.id
  GROUP BY unidad.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_solicitud_jefatura(UUID, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_solicitud_jefatura(UUID, BOOLEAN)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resumen_unidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_unidades() TO authenticated;
