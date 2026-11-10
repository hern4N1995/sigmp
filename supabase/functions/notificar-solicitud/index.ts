// Envía una notificación push a todos los dispositivos de administradores
// cuando se crea una solicitud. La invoca el trigger solicitudes_notificar_push
// (ver migración 20261110000000_notificaciones_push.sql).
//
// Secretos requeridos (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los provee Supabase automáticamente.

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!PUSH_WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== PUSH_WEBHOOK_SECRET) {
    return json({ error: "No autorizado" }, 401);
  }

  let solicitudId: string | undefined;
  try {
    ({ solicitud_id: solicitudId } = await req.json());
  } catch {
    // cuerpo inválido
  }
  if (!solicitudId) return json({ error: "Falta solicitud_id" }, 400);

  const { data: solicitud, error: solicitudError } = await supabase
    .from("solicitudes")
    .select("id, motivo, urgencia, usuario_id, solicitante_nombre, unidad_nombre_snapshot")
    .eq("id", solicitudId)
    .maybeSingle();
  if (solicitudError) return json({ error: solicitudError.message }, 500);
  if (!solicitud) return json({ error: "Solicitud inexistente" }, 404);

  const { data: admins, error: adminsError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "administrador");
  if (adminsError) return json({ error: adminsError.message }, 500);

  // No se avisa a quien cargó la solicitud (si es un administrador).
  const adminIds = (admins ?? [])
    .map((a) => a.user_id as string)
    .filter((id) => id !== solicitud.usuario_id);
  if (adminIds.length === 0) return json({ enviados: 0 });

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", adminIds);
  if (subsError) return json({ error: subsError.message }, 500);
  if (!subs || subs.length === 0) return json({ enviados: 0 });

  const urgente = solicitud.urgencia === "urgente";
  const quien = [solicitud.solicitante_nombre, solicitud.unidad_nombre_snapshot]
    .filter(Boolean)
    .join(" · ");
  const payload = JSON.stringify({
    title: urgente ? "Solicitud URGENTE" : "Nueva solicitud",
    body: quien ? `${solicitud.motivo}\n${quien}` : solicitud.motivo,
    url: "/admin/solicitudes",
    tag: `solicitud-${solicitud.id}`,
    urgente,
  });

  const vencidas: string[] = [];
  const resultados = await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: urgente ? "high" : "normal" },
        )
        .catch((err: { statusCode?: number }) => {
          // 404/410: el navegador dio de baja la suscripción.
          if (err?.statusCode === 404 || err?.statusCode === 410) vencidas.push(s.id);
          throw err;
        }),
    ),
  );

  if (vencidas.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", vencidas);
  }

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  const fallidos = resultados
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason?.body ?? r.reason?.message ?? r.reason));
  if (fallidos.length > 0) console.error("Push fallidos:", fallidos);

  return json({ enviados, fallidos: fallidos.length, eliminadas: vencidas.length });
});
