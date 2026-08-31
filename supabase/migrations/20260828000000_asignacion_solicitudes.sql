ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.asignar_responsable_solicitud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado = 'en_espera'
    AND NEW.estado IS DISTINCT FROM OLD.estado
    AND NEW.asignado_a IS NULL THEN
    NEW.asignado_a = auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_asignar_responsable_trigger ON public.solicitudes;
CREATE TRIGGER solicitudes_asignar_responsable_trigger
BEFORE UPDATE ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.asignar_responsable_solicitud();

ALTER FUNCTION public.asignar_responsable_solicitud() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.asignar_responsable_solicitud() FROM PUBLIC, anon, authenticated;
