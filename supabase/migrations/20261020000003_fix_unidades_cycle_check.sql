CREATE OR REPLACE FUNCTION public.prevenir_ciclo_unidades()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.padre_id IS NOT NULL AND NEW.id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestros(id, padre_id) AS (
      SELECT u.id, u.padre_id
      FROM public.unidades AS u
      WHERE u.id = NEW.padre_id

      UNION

      SELECT padre.id, padre.padre_id
      FROM public.unidades AS padre
      JOIN ancestros AS hijo ON padre.id = hijo.padre_id
    )
    SELECT 1 FROM ancestros WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'La unidad no puede depender de sí misma ni de una unidad descendiente'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevenir_ciclo_unidades() FROM PUBLIC, anon, authenticated;
