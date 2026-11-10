-- Notificaciones push (Web Push) para avisar a los administradores en el celular
-- cuando entra una solicitud nueva, aunque no tengan el sistema abierto.
--
-- Flujo: INSERT en solicitudes -> trigger -> pg_net llama a la Edge Function
-- "notificar-solicitud" -> la función envía el push a cada dispositivo suscrito.
--
-- La URL de la función y el secreto compartido se guardan en Vault (una sola vez,
-- desde el SQL Editor):
--   select vault.create_secret('https://<proyecto>.supabase.co/functions/v1/notificar-solicitud', 'notificar_solicitud_url');
--   select vault.create_secret('<mismo valor que PUSH_WEBHOOK_SECRET>', 'notificar_solicitud_secret');
-- Si no están cargados, el trigger no hace nada y la solicitud se crea igual.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Un registro por dispositivo/navegador suscrito.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada usuario ve y administra solo sus propios dispositivos.
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Si el mismo navegador ya estaba suscrito con otro usuario (se cambió de cuenta
-- en el mismo celular), el endpoint queda tomado por la otra cuenta y el UPSERT
-- del cliente no lo puede actualizar por RLS. Esta función lo reasigna al usuario
-- actual de forma segura.
CREATE OR REPLACE FUNCTION public.registrar_push_subscription(
  _endpoint TEXT,
  _p256dh TEXT,
  _auth TEXT,
  _user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), _endpoint, _p256dh, _auth, _user_agent)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        created_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Llama a la Edge Function con el id de la solicitud nueva. pg_net es asíncrono:
-- no demora el INSERT, y cualquier error queda registrado sin bloquear la carga.
CREATE OR REPLACE FUNCTION public.notificar_solicitud_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _secret TEXT;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _url
    FROM vault.decrypted_secrets WHERE name = 'notificar_solicitud_url' LIMIT 1;
    SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets WHERE name = 'notificar_solicitud_secret' LIMIT 1;

    IF _url IS NULL OR _secret IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', _secret
      ),
      body := jsonb_build_object('solicitud_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificar_solicitud_push: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notificar_solicitud_push() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS solicitudes_notificar_push ON public.solicitudes;
CREATE TRIGGER solicitudes_notificar_push
AFTER INSERT ON public.solicitudes
FOR EACH ROW
WHEN (NEW.estado = 'en_espera')
EXECUTE FUNCTION public.notificar_solicitud_push();
