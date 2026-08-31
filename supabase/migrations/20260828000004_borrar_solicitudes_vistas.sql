CREATE OR REPLACE FUNCTION public.eliminar_solicitud_cancelada_vista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado::text = 'cancelado' AND NEW.estado::text = 'visto' THEN
    DELETE FROM public.solicitudes WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_eliminar_cancelada_vista_trigger ON public.solicitudes;
CREATE TRIGGER solicitudes_eliminar_cancelada_vista_trigger
AFTER UPDATE ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.eliminar_solicitud_cancelada_vista();

ALTER FUNCTION public.eliminar_solicitud_cancelada_vista() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.eliminar_solicitud_cancelada_vista() FROM PUBLIC, anon, authenticated;
