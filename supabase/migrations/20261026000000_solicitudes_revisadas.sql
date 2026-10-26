-- Registra cuándo un administrador revisó (abrió) por primera vez una solicitud,
-- para resaltar en el listado las que todavía nadie miró.
ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS revisada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revisada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Toda solicitud nueva nace sin revisar, la envíe quien la envíe.
CREATE OR REPLACE FUNCTION public.solicitud_nace_sin_revisar()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.revisada_en := NULL;
  NEW.revisada_por := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_nace_sin_revisar ON public.solicitudes;
CREATE TRIGGER solicitudes_nace_sin_revisar
BEFORE INSERT ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.solicitud_nace_sin_revisar();

REVOKE EXECUTE ON FUNCTION public.solicitud_nace_sin_revisar() FROM PUBLIC, anon, authenticated;

-- Solo marca la primera revisión y no toca ninguna otra columna, así no pasa por
-- las validaciones de estado de la política de UPDATE.
CREATE OR REPLACE FUNCTION public.marcar_solicitud_revisada(_solicitud_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Solo un administrador puede marcar solicitudes como revisadas'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.solicitudes
  SET revisada_en = now(), revisada_por = auth.uid()
  WHERE id = _solicitud_id AND revisada_en IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_solicitud_revisada(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_solicitud_revisada(UUID) TO authenticated;
