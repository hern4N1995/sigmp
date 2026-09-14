-- Agregar columna resolucion a solicitudes para guardar comentarios cuando se finaliza
ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS resolucion TEXT;

-- Comentario sobre la columna
COMMENT ON COLUMN public.solicitudes.resolucion IS 'Descripción de lo que se hizo para resolver la solicitud';
