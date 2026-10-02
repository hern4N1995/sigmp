CREATE UNIQUE INDEX IF NOT EXISTS profiles_dni_unique_idx
  ON public.profiles (dni)
  WHERE dni IS NOT NULL;
