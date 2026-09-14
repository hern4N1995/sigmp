-- Agregar el valor 'pausado' al enum estado_solicitud
ALTER TYPE public.estado_solicitud ADD VALUE IF NOT EXISTS 'pausado';

-- Crear tabla motivos_pausa
CREATE TABLE public.motivos_pausa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descripcion TEXT NOT NULL UNIQUE,
  orden INT NOT NULL
);

-- Habilitar RLS en motivos_pausa
ALTER TABLE public.motivos_pausa ENABLE ROW LEVEL SECURITY;

-- Policy SELECT para authenticated
CREATE POLICY "Authenticated can select motivos_pausa" ON public.motivos_pausa
FOR SELECT TO authenticated
USING (true);

-- Insertar motivos predefinidos
INSERT INTO public.motivos_pausa (descripcion, orden) VALUES
  ('En espera de autorización de compra', 1),
  ('Falta de disco', 2),
  ('Falta de RAM', 3),
  ('Falta de fuente', 4),
  ('Falta de placa madre', 5),
  ('Otro', 6)
ON CONFLICT (descripcion) DO NOTHING;

-- Agregar columnas a solicitudes
ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS motivo_pausa_id UUID REFERENCES public.motivos_pausa(id),
  ADD COLUMN IF NOT EXISTS motivo_pausa_detalle TEXT;

-- Crear función para validar transiciones de estado
CREATE OR REPLACE FUNCTION public.validar_transicion_estado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si el estado cambia a 'pausado', debe venir de 'en_proceso'
  IF NEW.estado = 'pausado' AND OLD.estado <> 'en_proceso' THEN
    RAISE EXCEPTION 'El estado pausado solo puede alcanzarse desde en_proceso';
  END IF;

  -- Si el estado sale de 'pausado', puede ir a 'en_proceso' o 'finalizado'
  IF OLD.estado = 'pausado' AND NEW.estado NOT IN ('pausado', 'en_proceso', 'finalizado') THEN
    RAISE EXCEPTION 'Desde pausado solo se puede ir a en_proceso o finalizado';
  END IF;

  -- Si el estado es 'pausado', se requieren los campos de pausa
  IF NEW.estado = 'pausado' THEN
    IF NEW.motivo_pausa_id IS NULL THEN
      RAISE EXCEPTION 'Se requiere seleccionar un motivo de pausa';
    END IF;
    -- Si es 'Otro', se requiere el detalle
    IF (SELECT descripcion FROM public.motivos_pausa WHERE id = NEW.motivo_pausa_id) = 'Otro' THEN
      IF NEW.motivo_pausa_detalle IS NULL OR btrim(NEW.motivo_pausa_detalle) = '' THEN
        RAISE EXCEPTION 'Se requiere completar el motivo de pausa cuando se selecciona Otro';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger para validar transiciones de estado
DROP TRIGGER IF EXISTS solicitudes_validar_transicion ON public.solicitudes;
CREATE TRIGGER solicitudes_validar_transicion
BEFORE UPDATE ON public.solicitudes
FOR EACH ROW
EXECUTE FUNCTION public.validar_transicion_estado();

-- Actualizar la policy de UPDATE para admins para que cubra las nuevas columnas
-- (La política existente ya cubre la fila completa, por lo que no se necesita cambio explícito)

-- Dar permisos a authenticated en la tabla solicitudes (actualizar solo las nuevas columnas)
GRANT SELECT, INSERT, UPDATE (estado, motivo_pausa_id, motivo_pausa_detalle) ON public.solicitudes TO authenticated;
