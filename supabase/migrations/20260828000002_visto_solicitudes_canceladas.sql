ALTER TYPE public.estado_solicitud ADD VALUE 'visto';

CREATE OR REPLACE FUNCTION public.proteger_solicitud_cancelada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado::text IN ('cancelado', 'visto')
    AND NEW.estado::text NOT IN ('cancelado', 'visto') THEN
    RAISE EXCEPTION 'Una solicitud cancelada solo puede pasar a visto';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER solicitudes_proteger_cancelada_trigger
BEFORE UPDATE ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.proteger_solicitud_cancelada();

ALTER FUNCTION public.proteger_solicitud_cancelada() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.proteger_solicitud_cancelada() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_puede_actualizar_solicitud(
  _solicitud_id UUID,
  _nuevo_estado TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.solicitudes
    WHERE id = _solicitud_id
      AND (
        estado::text NOT IN ('cancelado', 'visto')
        OR _nuevo_estado = 'visto'
      )
  );
$$;

DROP POLICY "Admins update solicitudes" ON public.solicitudes;
CREATE POLICY "Admins update solicitudes" ON public.solicitudes
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'))
WITH CHECK (
  public.has_role(auth.uid(), 'administrador')
  AND public.admin_puede_actualizar_solicitud(id, estado::text)
);

ALTER FUNCTION public.admin_puede_actualizar_solicitud(UUID, TEXT) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.admin_puede_actualizar_solicitud(UUID, TEXT) FROM PUBLIC, anon, authenticated;