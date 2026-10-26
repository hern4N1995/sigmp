-- Limita lo que un usuario que no es administrador puede hacer con solicitudes,
-- sin depender de lo que envíe el frontend:
--   * Al crear: solo solicitudes nuevas "en espera", de su propia unidad y sin
--     datos de gestión (asignación, resolución, pausa, cancelación).
--   * Al modificar: solo cancelar una solicitud en espera o en proceso,
--     cambiando únicamente el estado y el motivo de cancelación.
-- Los administradores y los procesos internos (auth.uid() nulo) no se ven afectados.
--
-- El nombre del trigger empieza con "zz" para que se ejecute después de los
-- demás BEFORE triggers de solicitudes (Postgres los ordena alfabéticamente) y
-- así revise los valores finales.
CREATE OR REPLACE FUNCTION public.restringir_solicitud_no_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unidad_usuario UUID;
  columnas_editables TEXT[] := ARRAY['estado', 'motivo_cancelacion', 'asignado_a'];
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'administrador') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estado::text <> 'en_espera' THEN
      RAISE EXCEPTION 'Las solicitudes nuevas deben crearse en espera'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.asignado_a IS NOT NULL
      OR NEW.colaborador_id IS NOT NULL
      OR NEW.resolucion IS NOT NULL
      OR NEW.motivo_pausa_id IS NOT NULL
      OR NEW.motivo_pausa_detalle IS NOT NULL
      OR NEW.motivo_cancelacion IS NOT NULL
      OR NEW.fecha_finalizacion IS NOT NULL THEN
      RAISE EXCEPTION 'Solo un administrador puede cargar datos de gestión de la solicitud'
        USING ERRCODE = '42501';
    END IF;

    SELECT unidad_id INTO unidad_usuario FROM public.profiles WHERE id = auth.uid();
    IF NEW.unidad_id IS DISTINCT FROM unidad_usuario THEN
      RAISE EXCEPTION 'La solicitud debe corresponder a tu unidad'
        USING ERRCODE = '42501';
    END IF;

    IF char_length(btrim(NEW.motivo)) NOT BETWEEN 3 AND 120
      OR char_length(btrim(NEW.descripcion)) NOT BETWEEN 5 AND 1000 THEN
      RAISE EXCEPTION 'El motivo o la descripción no tienen una longitud válida'
        USING ERRCODE = '23514';
    END IF;

    NEW.fecha_creacion := now();
    RETURN NEW;
  END IF;

  -- UPDATE: la única modificación permitida es cancelar.
  IF NEW.estado::text <> 'cancelado'
    OR OLD.estado::text NOT IN ('en_espera', 'en_proceso') THEN
    RAISE EXCEPTION 'Solo podés cancelar solicitudes en espera o en proceso'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.motivo_cancelacion IS NULL
    OR char_length(btrim(NEW.motivo_cancelacion)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'El motivo de cancelación no tiene una longitud válida'
      USING ERRCODE = '23514';
  END IF;

  -- El trigger de asignación toma como responsable a quien cambia el estado;
  -- al cancelar un empleado no corresponde, así que se conserva el anterior.
  NEW.asignado_a := OLD.asignado_a;

  IF (to_jsonb(NEW) - columnas_editables) IS DISTINCT FROM (to_jsonb(OLD) - columnas_editables) THEN
    RAISE EXCEPTION 'Al cancelar solo se puede indicar el motivo de cancelación'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_zz_restringir_no_admin ON public.solicitudes;
CREATE TRIGGER solicitudes_zz_restringir_no_admin
BEFORE INSERT OR UPDATE ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.restringir_solicitud_no_admin();

REVOKE EXECUTE ON FUNCTION public.restringir_solicitud_no_admin() FROM PUBLIC, anon, authenticated;
