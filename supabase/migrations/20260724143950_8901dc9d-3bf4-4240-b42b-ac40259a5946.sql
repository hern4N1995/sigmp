
-- Update handle_new_user to always make sistemasmprod@gmail.com admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_count INT;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'given_name', split_part(NEW.raw_user_meta_data->>'full_name',' ',1)),
    COALESCE(NEW.raw_user_meta_data->>'family_name', NULLIF(split_part(NEW.raw_user_meta_data->>'full_name',' ',2),''))
  );

  IF NEW.email = 'sistemasmprod@gmail.com' THEN
    assigned_role := 'administrador'::public.app_role;
  ELSE
    SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'administrador';
    assigned_role := CASE WHEN admin_count = 0 THEN 'administrador'::public.app_role ELSE 'empleado'::public.app_role END;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $function$;

-- Promote existing sistemasmprod@gmail.com to administrator if present
DO $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'sistemasmprod@gmail.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'administrador'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    -- Remove employee role if present
    DELETE FROM public.user_roles WHERE user_id = uid AND role = 'empleado'::public.app_role;
  END IF;
END $$;

-- Profiles: allow admins to update any profile
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));

-- user_roles: admins can view, insert, update, delete
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
CREATE POLICY "Admins update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'administrador'::public.app_role));

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'::public.app_role));
