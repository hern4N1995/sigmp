
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
