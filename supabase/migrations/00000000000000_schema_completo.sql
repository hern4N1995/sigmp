
-- Enums
CREATE TYPE public.app_role AS ENUM ('empleado', 'administrador');
CREATE TYPE public.urgencia AS ENUM ('urgente', 'normal');
CREATE TYPE public.estado_solicitud AS ENUM ('en_espera', 'en_proceso', 'finalizado');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellido TEXT,
  dni TEXT,
  area TEXT,
  email TEXT,
  perfil_completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- solicitudes
CREATE TABLE public.solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  urgencia public.urgencia NOT NULL DEFAULT 'normal',
  estado public.estado_solicitud NOT NULL DEFAULT 'en_espera',
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_finalizacion TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes TO authenticated;
GRANT ALL ON public.solicitudes TO service_role;
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile & role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, apellido)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'given_name', split_part(NEW.raw_user_meta_data->>'full_name',' ',1)),
    COALESCE(NEW.raw_user_meta_data->>'family_name', NULLIF(split_part(NEW.raw_user_meta_data->>'full_name',' ',2),''))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'empleado');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set finalized date automatically
CREATE OR REPLACE FUNCTION public.handle_solicitud_finalizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'finalizado' AND (OLD.estado IS DISTINCT FROM 'finalizado') THEN
    NEW.fecha_finalizacion = now();
  ELSIF NEW.estado <> 'finalizado' THEN
    NEW.fecha_finalizacion = NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER solicitudes_estado_trigger BEFORE UPDATE ON public.solicitudes
FOR EACH ROW EXECUTE FUNCTION public.handle_solicitud_finalizado();

-- RLS Policies: profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- RLS Policies: user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'administrador'));

-- RLS Policies: solicitudes
CREATE POLICY "Employees view own solicitudes" ON public.solicitudes FOR SELECT TO authenticated
USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Employees create own solicitudes" ON public.solicitudes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Admins update solicitudes" ON public.solicitudes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'administrador')) WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "Admins delete solicitudes" ON public.solicitudes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes;



ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_solicitud_finalizado() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_solicitud_finalizado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;



CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'administrador';
  assigned_role := CASE WHEN admin_count = 0 THEN 'administrador'::public.app_role ELSE 'empleado'::public.app_role END;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);

  RETURN NEW;
END; $$;



-- Assign the first registered user as administrator and the rest as employees
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

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'administrador';
  assigned_role := CASE
    WHEN admin_count = 0 THEN 'administrador'::public.app_role
    ELSE 'empleado'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END; $function$;

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
