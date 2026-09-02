ALTER TABLE public.solicitudes
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.solicitudes
  DROP CONSTRAINT IF EXISTS solicitudes_usuario_id_fkey;

ALTER TABLE public.solicitudes
  ADD CONSTRAINT solicitudes_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS solicitante_nombre TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_email TEXT,
  ADD COLUMN IF NOT EXISTS solicitante_area TEXT;

UPDATE public.solicitudes AS s
SET
  solicitante_nombre = NULLIF(concat_ws(' ', p.nombre, p.apellido), ''),
  solicitante_email = p.email,
  solicitante_area = p.area
FROM public.profiles AS p
WHERE s.usuario_id = p.id
  AND (s.solicitante_nombre IS NULL OR s.solicitante_email IS NULL OR s.solicitante_area IS NULL);

CREATE OR REPLACE FUNCTION public.snapshot_solicitante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT NULLIF(concat_ws(' ', nombre, apellido), ''), email, area
    INTO NEW.solicitante_nombre, NEW.solicitante_email, NEW.solicitante_area
    FROM public.profiles
    WHERE id = NEW.usuario_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS solicitudes_snapshot_solicitante ON public.solicitudes;
CREATE TRIGGER solicitudes_snapshot_solicitante
BEFORE INSERT ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.snapshot_solicitante();

ALTER FUNCTION public.snapshot_solicitante() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.snapshot_solicitante() FROM PUBLIC, anon, authenticated;