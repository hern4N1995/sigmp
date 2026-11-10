import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_URL = "/sw.js";

export type PushStatus =
  /** Todavía se está consultando el estado. */
  | "loading"
  /** El navegador no soporta push o falta configurar la clave VAPID. */
  | "unsupported"
  /** El sitio no se sirve por HTTPS (p. ej. la instancia del NAS por http). */
  | "insecure"
  /** iPhone/iPad: hay que agregar el sistema a la pantalla de inicio primero. */
  | "ios-needs-install"
  /** El usuario bloqueó las notificaciones para este sitio. */
  | "denied"
  | "subscribed"
  | "unsubscribed";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function detectStaticStatus(): PushStatus | null {
  if (typeof window === "undefined") return "loading";
  if (!window.isSecureContext) return "insecure";
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return null;
}

async function getRegistration() {
  return (
    (await navigator.serviceWorker.getRegistration(SW_URL)) ??
    (await navigator.serviceWorker.register(SW_URL, { scope: "/" }))
  );
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("registrar_push_subscription", {
    _endpoint: sub.endpoint,
    _p256dh: json.keys?.p256dh ?? "",
    _auth: json.keys?.auth ?? "",
    _user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

/**
 * Da de baja las notificaciones de este dispositivo (navegador + base de datos).
 * Se usa al cerrar sesión, para que el celular deje de recibir avisos de esa cuenta.
 */
export async function removePushSubscription() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch (error) {
    console.error("No se pudo dar de baja la suscripción push.", error);
  }
}

export function usePushNotifications(enabled: boolean) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const staticStatus = detectStaticStatus();
    if (staticStatus) {
      setStatus(staticStatus);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub && Notification.permission === "granted") {
          // Re-sincroniza por si la fila se borró o cambió de usuario en este equipo.
          await saveSubscription(sub);
          if (!cancelled) setStatus("subscribed");
        } else if (!cancelled) {
          setStatus("unsubscribed");
        }
      } catch (error) {
        console.error("No se pudo consultar el estado de las notificaciones push.", error);
        if (!cancelled) setStatus("unsubscribed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) throw new Error("Falta configurar VITE_VAPID_PUBLIC_KEY.");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return false;
      }
      const reg = await getRegistration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      await saveSubscription(sub);
      setStatus("subscribed");
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      await removePushSubscription();
      setStatus("unsubscribed");
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, subscribe, unsubscribe };
}
