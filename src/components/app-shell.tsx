import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PlusCircle, ClipboardList, LogOut, ShieldCheck, BarChart3, Sun, Moon, Menu, X, Bell, Users, UserCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("light", initial === "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  };
  return { theme, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [displayName, setDisplayName] = useState<string>("");
  const previousPending = useRef<number | null>(null);
  const notificationActive = useRef(false);
  const repeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const playNotificationSound = () => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    if (context.state === "suspended") void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  };

  const stopNotificationSound = () => {
    notificationActive.current = false;
    if (repeatTimer.current) clearTimeout(repeatTimer.current);
    repeatTimer.current = null;
  };

  const startNotificationSound = () => {
    if (notificationActive.current) return;
    notificationActive.current = true;
    playNotificationSound();
    const repeat = () => {
      if (!notificationActive.current) return;
      playNotificationSound();
      repeatTimer.current = setTimeout(repeat, 10 * 60 * 1000);
    };
    repeatTimer.current = setTimeout(repeat, 10 * 60 * 1000);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDisplayName(`${data.nombre ?? ""} ${data.apellido ?? ""}`.trim());
      });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const { count } = await supabase
        .from("solicitudes")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_espera");
      const nextPending = count ?? 0;
      if (previousPending.current !== null && nextPending > previousPending.current) {
        startNotificationSound();
      }
      previousPending.current = nextPending;
      setPending(nextPending);
    };
    load();
    const channel = supabase
      .channel("solicitudes-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      stopNotificationSound();
      if (audioContext.current) void audioContext.current.close();
    };
  }, [isAdmin]);

  const reviewNotifications = () => {
    stopNotificationSound();
    navigate({ to: "/admin/solicitudes" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const empLinks = [
    { to: "/nueva-solicitud", label: "Nueva solicitud", icon: PlusCircle },
    { to: "/mis-solicitudes", label: "Mis solicitudes", icon: ClipboardList },
    { to: "/perfil", label: "Mi perfil", icon: UserCircle },
  ];
  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList },
    { to: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3 },
    { to: "/admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/perfil", label: "Mi perfil", icon: UserCircle },
  ];

  const links = isAdmin ? adminLinks : empLinks;

  const NavItems = () => (
    <>
      <div className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isAdmin ? (
          <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Administración</span>
        ) : (
          "Menú"
        )}
      </div>
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.to || (l.to !== "/admin" && l.to !== "/perfil" && pathname.startsWith(l.to));
        return (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-foreground/80 hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              {l.label}
            </span>
            {l.to === "/admin/solicitudes" && pending > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  const ProfileMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserCircle className="h-4 w-4" />
          </div>
          <span className="hidden max-w-[140px] truncate text-sm sm:inline">
            {displayName || user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="font-semibold">{displayName || "Mi cuenta"}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{user?.email}</div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
            <ShieldCheck className="h-3 w-3" />
            {isAdmin ? "Administrador" : "Empleado"}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
          <UserCircle className="mr-2 h-4 w-4" /> Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggle}>
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          Tema {theme === "dark" ? "claro" : "oscuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Soporte Sistemas</div>
            <div className="text-[11px] text-muted-foreground">Min. de Producción</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          <NavItems />
        </nav>
      </aside>

      {/* Desktop header */}
      <header className="sticky top-0 z-20 hidden h-16 items-center justify-end border-b border-border bg-background/80 px-6 backdrop-blur lg:flex lg:pl-[17rem]">
        {isAdmin && pending > 0 && (
          <button type="button" aria-label="Revisar solicitudes pendientes" onClick={reviewNotifications} className="relative mr-3 rounded-md p-1 hover:bg-accent">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {pending}
            </span>
          </button>
        )}
        <ProfileMenu />
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Soporte Sistemas</span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && pending > 0 && (
            <button type="button" aria-label="Revisar solicitudes pendientes" onClick={reviewNotifications} className="relative mr-1 rounded-md p-1 hover:bg-accent">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {pending}
              </span>
            </button>
          )}
          <ProfileMenu />
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-x-0 top-14 z-20 border-b border-border bg-sidebar px-3 py-3 lg:hidden">
          <nav className="space-y-0.5">
            <NavItems />
          </nav>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
