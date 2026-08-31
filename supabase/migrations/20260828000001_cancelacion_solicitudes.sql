ALTER TYPE public.estado_solicitud ADD VALUE IF NOT EXISTS 'cancelado';

ALTER TABLE public.solicitudes
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;

DROP POLICY IF EXISTS "Employees cancel own solicitudes same day" ON public.solicitudes;

CREATE POLICY "Employees cancel own solicitudes same day"
ON public.solicitudes
FOR UPDATE
TO authenticated
USING (
  auth.uid() = usuario_id
  AND date_trunc('day', fecha_creacion) = date_trunc('day', now())
)
WITH CHECK (
  auth.uid() = usuario_id
  AND date_trunc('day', fecha_creacion) = date_trunc('day', now())
  AND estado::text = 'cancelado'
  AND motivo_cancelacion IS NOT NULL
  AND btrim(motivo_cancelacion) <> ''
);