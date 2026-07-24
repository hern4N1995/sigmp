import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PlusCircle, ClipboardList, LogOut, ShieldCheck, BarChart3, Sun, Moon, Menu, X, Bell } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const { count } = await supabase
        .from("solicitudes")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_espera");
      setPending(count ?? 0);
    };
    load();
    const channel = supabase
      .channel("solicitudes-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const empLinks = [
    { to: "/nueva-solicitud", label: "Nueva solicitud", icon: PlusCircle },
    { to: "/mis-solicitudes", label: "Mis solicitudes", icon: ClipboardList },
  ];
  const adminLinks = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList },
    { to: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3 },
  ];

  const NavItems = () => (
    <>
      <div className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Empleado
      </div>
      {empLinks.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.to;
        return (
          <Link
            key={l.to}
            to={l.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-foreground/80 hover:bg-accent/40 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
      {isAdmin && (
        <>
          <div className="mt-4 flex items-center gap-2 px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Administración
          </div>
          {adminLinks.map((l) => {
            const Icon = l.icon;
            const active = pathname === l.to || (l.to !== "/admin" && pathname.startsWith(l.to));
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
      )}
    </>
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
        <div className="border-t border-border p-3">
          <div className="mb-2 truncate rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {user?.email}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

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
            <div className="relative mr-1">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {pending}
              </span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggle}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
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
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 truncate rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {user?.email}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
