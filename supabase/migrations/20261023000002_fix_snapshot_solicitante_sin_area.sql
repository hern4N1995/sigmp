-- La migración 20261020000001 eliminó profiles.area y solicitudes.solicitante_area,
-- pero snapshot_solicitante seguía usándolas y fallaba al crear cada solicitud con
-- 'column "area" does not exist'. La unidad ya se guarda en unidad_nombre_snapshot.
CREATE OR REPLACE FUNCTION public.snapshot_solicitante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.usuario_id IS NOT NULL THEN
    SELECT NULLIF(concat_ws(' ', nombre, apellido), ''), email
    INTO NEW.solicitante_nombre, NEW.solicitante_email
    FROM public.profiles
    WHERE id = NEW.usuario_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.snapshot_solicitante() FROM PUBLIC, anon, authenticated;
