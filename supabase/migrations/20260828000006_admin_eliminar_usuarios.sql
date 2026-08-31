CREATE OR REPLACE FUNCTION public.eliminar_usuario(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrador'::public.app_role) THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar usuarios';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés eliminar tu propio usuario';
  END IF;

  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

ALTER FUNCTION public.eliminar_usuario(UUID) SET search_path = public, auth;
REVOKE EXECUTE ON FUNCTION public.eliminar_usuario(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_usuario(UUID) TO authenticated;
