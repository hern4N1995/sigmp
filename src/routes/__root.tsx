import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[App Error]", error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#08120c" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "SIG | Área de Sistemas" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "SIG - Ministerio de Producción" },
      {
        name: "description",
        content:
          "Sistema interno de gestión de solicitudes de soporte técnico del Ministerio de Producción.",
      },
      { name: "author", content: "Ministerio de Producción" },
      { property: "og:title", content: "Soporte Sistemas — Ministerio de Producción" },
      {
        property: "og:description",
        content: "Portal interno de mesa de ayuda del Área de Sistemas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/escudo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isStandalone) {
      setShowStartupSplash(false);
      return;
    }
    const timer = window.setTimeout(() => setShowStartupSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const idleLimit = 2 * 60 * 60 * 1000;
    let activeUserId: string | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastActivity = 0;
    let lastPersistedActivity = 0;

    const clearTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };

    const activityKey = (userId: string) => `sig:last-activity:${userId}`;

    const scheduleTimeout = () => {
      clearTimer();
      if (!activeUserId) return;
      const userId = activeUserId;
      const remaining = Math.max(0, idleLimit - (Date.now() - lastActivity));
      idleTimer = setTimeout(() => {
        if (activeUserId !== userId) return;
        const key = activityKey(userId);
        const sharedActivity = Number(localStorage.getItem(key));
        if (Number.isFinite(sharedActivity) && sharedActivity > lastActivity) {
          lastActivity = sharedActivity;
        }
        if (Date.now() - lastActivity < idleLimit) {
          scheduleTimeout();
          return;
        }
        activeUserId = null;
        void supabase.auth.signOut().then(({ error }) => {
          if (error) {
            console.error("No se pudo cerrar la sesión por inactividad.", error);
            activeUserId = userId;
            lastActivity = Date.now() - idleLimit + 60_000;
            scheduleTimeout();
          } else {
            localStorage.removeItem(key);
          }
        });
      }, remaining);
    };

    const startSession = (userId: string) => {
      if (activeUserId === userId) return;
      clearTimer();
      activeUserId = userId;
      const storedActivity = Number(localStorage.getItem(activityKey(userId)));
      lastActivity =
        Number.isFinite(storedActivity) && storedActivity > 0 ? storedActivity : Date.now();
      lastPersistedActivity = lastActivity;
      localStorage.setItem(activityKey(userId), String(lastActivity));
      scheduleTimeout();
    };

    const recordActivity = () => {
      if (!activeUserId) return;
      const now = Date.now();
      lastActivity = now;
      if (now - lastPersistedActivity >= 2_000) {
        localStorage.setItem(activityKey(activeUserId), String(now));
        lastPersistedActivity = now;
      }
      scheduleTimeout();
    };

    const onStorage = (event: StorageEvent) => {
      if (!activeUserId || event.key !== activityKey(activeUserId) || !event.newValue) return;
      const sharedActivity = Number(event.newValue);
      if (Number.isFinite(sharedActivity) && sharedActivity > lastActivity) {
        lastActivity = sharedActivity;
        scheduleTimeout();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleTimeout();
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
      "wheel",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id;
      if (userId) {
        startSession(userId);
      } else if (event === "SIGNED_OUT" && activeUserId) {
        const previousUserId = activeUserId;
        activeUserId = null;
        clearTimer();
        localStorage.removeItem(activityKey(previousUserId));
      }
    });

    return () => {
      clearTimer();
      sub.subscription.unsubscribe();
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {showStartupSplash && (
        <div className="app-startup-splash" aria-hidden="true">
          <div className="app-startup-brand">
            <img src="/escudo.png" alt="" />
            <div className="app-startup-title">SIG | Área de Sistemas</div>
            <div className="app-startup-subtitle">
              Sistema Interno de Gestión del Ministerio de Producción
            </div>
          </div>
        </div>
      )}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
