DROP POLICY IF EXISTS "Employees delete own cancelled solicitudes" ON public.solicitudes;

CREATE POLICY "Employees delete own cancelled solicitudes"
ON public.solicitudes
FOR DELETE
TO authenticated
USING (
  auth.uid() = usuario_id
  AND estado::text = 'cancelado'
);