-- 1) El email del perfil siempre refleja el email real de la cuenta (auth.users).
--    Evita que un usuario figure en sus solicitudes con el email de otra persona.
CREATE OR REPLACE FUNCTION public.sincronizar_email_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT email INTO NEW.email FROM auth.users WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sincronizar_email ON public.profiles;
CREATE TRIGGER profiles_sincronizar_email
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sincronizar_email_profile();

REVOKE EXECUTE ON FUNCTION public.sincronizar_email_profile() FROM PUBLIC, anon, authenticated;

-- Si la cuenta cambia de email, el perfil se actualiza también.
CREATE OR REPLACE FUNCTION public.propagar_email_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (NEW.email IS DISTINCT FROM OLD.email)
EXECUTE FUNCTION public.propagar_email_usuario();

REVOKE EXECUTE ON FUNCTION public.propagar_email_usuario() FROM PUBLIC, anon, authenticated;

-- Corrige perfiles que ya tengan un email distinto al de su cuenta.
UPDATE public.profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE u.id = p.id
  AND p.email IS DISTINCT FROM u.email;

-- 5) Funciones auxiliares de RLS.
--    No se les puede quitar EXECUTE a authenticated porque las políticas las
--    evalúan con los permisos de quien consulta. En su lugar, solo responden
--    sobre otros usuarios o solicitudes si quien pregunta es administrador.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
  AND (
    auth.uid() IS NULL
    OR _user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'administrador'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_puede_actualizar_solicitud(
  _solicitud_id UUID,
  _nuevo_estado TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'administrador')
    AND EXISTS (
      SELECT 1
      FROM public.solicitudes
      WHERE id = _solicitud_id
        AND (
          estado::text NOT IN ('cancelado', 'visto')
          OR _nuevo_estado = 'visto'
        )
    );
$$;
