CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (
    tipo IN (
      'ministerio',
      'secretaria',
      'subsecretaria',
      'direccion',
      'subdireccion',
      'departamento',
      'area',
      'organismo',
      'programa',
      'centro'
    )
  ),
  padre_id UUID REFERENCES public.unidades(id) ON DELETE RESTRICT,
  cargo_jefe TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX unidades_nombre_hermano_uidx
  ON public.unidades (
    (COALESCE(padre_id, '00000000-0000-0000-0000-000000000000'::UUID)),
    lower(nombre)
  );

CREATE UNIQUE INDEX unidades_una_raiz_uidx
  ON public.unidades ((true))
  WHERE padre_id IS NULL;

CREATE OR REPLACE FUNCTION public.prevenir_ciclo_unidades()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.padre_id IS NOT NULL AND NEW.id IS NOT NULL AND EXISTS (
    WITH RECURSIVE descendientes(id) AS (
      SELECT NEW.padre_id
      UNION
      SELECT u.id
      FROM public.unidades AS u
      JOIN descendientes AS d ON u.padre_id = d.id
    )
    SELECT 1 FROM descendientes WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'La unidad no puede depender de sí misma ni de una unidad descendiente'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER unidades_prevenir_ciclo
BEFORE INSERT OR UPDATE OF padre_id ON public.unidades
FOR EACH ROW EXECUTE FUNCTION public.prevenir_ciclo_unidades();

CREATE TRIGGER unidades_updated_at
BEFORE UPDATE ON public.unidades
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.unidades_arbol
WITH (security_invoker = true)
AS
WITH RECURSIVE unidades_ordenadas AS (
  SELECT
    u.*,
    row_number() OVER (PARTITION BY u.padre_id ORDER BY u.orden, u.nombre) AS posicion
  FROM public.unidades AS u
),
arbol AS (
  SELECT
    u.id,
    u.padre_id,
    u.nombre,
    u.tipo,
    u.cargo_jefe,
    u.activo,
    u.orden,
    1::INTEGER AS nivel,
    '1'::TEXT AS codigo,
    u.nombre::TEXT AS ruta
  FROM unidades_ordenadas AS u
  WHERE u.padre_id IS NULL

  UNION ALL

  SELECT
    hijo.id,
    hijo.padre_id,
    hijo.nombre,
    hijo.tipo,
    hijo.cargo_jefe,
    hijo.activo,
    hijo.orden,
    padre.nivel + 1,
    padre.codigo || '.' || hijo.posicion::TEXT,
    padre.ruta || ' > ' || hijo.nombre
  FROM unidades_ordenadas AS hijo
  JOIN arbol AS padre ON hijo.padre_id = padre.id
)
SELECT id, padre_id, nombre, tipo, cargo_jefe, activo, orden, nivel, codigo, ruta
FROM arbol;

GRANT SELECT ON public.unidades, public.unidades_arbol TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view unidades"
  ON public.unidades FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert unidades"
  ON public.unidades FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update unidades"
  ON public.unidades FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete unidades"
  ON public.unidades FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

ALTER TABLE public.profiles
  ADD COLUMN unidad_id UUID REFERENCES public.unidades(id) ON DELETE RESTRICT,
  ADD COLUMN es_jefe BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN solicitud_jefe TEXT CHECK (solicitud_jefe IN ('pendiente', 'rechazada')),
  ADD CONSTRAINT profiles_jefe_requiere_unidad_check
    CHECK (NOT es_jefe OR unidad_id IS NOT NULL),
  ADD CONSTRAINT profiles_solicitud_jefe_requiere_unidad_check
    CHECK (solicitud_jefe IS NULL OR unidad_id IS NOT NULL);

CREATE UNIQUE INDEX profiles_unidad_un_jefe_uidx
  ON public.profiles (unidad_id)
  WHERE es_jefe = true AND unidad_id IS NOT NULL;

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE OR REPLACE FUNCTION public.validar_jefatura_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  es_administrador BOOLEAN := public.has_role(auth.uid(), 'administrador');
BEGIN
  IF es_administrador OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.es_jefe THEN
      RAISE EXCEPTION 'Solo un administrador puede asignar una jefatura'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.solicitud_jefe IS NOT NULL AND NEW.solicitud_jefe <> 'pendiente' THEN
      RAISE EXCEPTION 'La solicitud de jefatura debe ser pendiente'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.uid() <> OLD.id THEN
      RETURN NEW;
    END IF;
    IF NEW.es_jefe IS DISTINCT FROM OLD.es_jefe THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar una jefatura'
        USING ERRCODE = '42501';
    END IF;
    IF OLD.es_jefe AND NEW.unidad_id IS DISTINCT FROM OLD.unidad_id THEN
      RAISE EXCEPTION 'Un administrador debe cambiar la unidad de una persona con jefatura aprobada'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.solicitud_jefe IS DISTINCT FROM OLD.solicitud_jefe
      AND NEW.solicitud_jefe IS DISTINCT FROM 'pendiente' THEN
      RAISE EXCEPTION 'Solo un administrador puede resolver una solicitud de jefatura'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.unidad_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.unidades WHERE id = NEW.unidad_id AND activo
  ) THEN
    RAISE EXCEPTION 'Solo se puede seleccionar una unidad activa'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_validar_jefatura
BEFORE INSERT OR UPDATE OF unidad_id, es_jefe, solicitud_jefe ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validar_jefatura_profile();

REVOKE EXECUTE ON FUNCTION public.prevenir_ciclo_unidades() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_jefatura_profile() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.solicitudes
  ADD COLUMN unidad_id UUID REFERENCES public.unidades(id) ON DELETE RESTRICT,
  ADD COLUMN unidad_nombre_snapshot TEXT;

CREATE OR REPLACE FUNCTION public.guardar_snapshot_unidad_solicitud()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  nombre_unidad TEXT;
BEGIN
  IF NEW.unidad_id IS NULL THEN
    NEW.unidad_nombre_snapshot := NULL;
  ELSE
    SELECT nombre
    INTO nombre_unidad
    FROM public.unidades
    WHERE id = NEW.unidad_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'La unidad seleccionada no existe'
        USING ERRCODE = '23503';
    END IF;
    NEW.unidad_nombre_snapshot := nombre_unidad;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER solicitudes_guardar_snapshot_unidad
BEFORE INSERT ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.guardar_snapshot_unidad_solicitud();

REVOKE EXECUTE ON FUNCTION public.guardar_snapshot_unidad_solicitud() FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.unidades_arbol TO authenticated;
