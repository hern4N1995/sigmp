import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { LayoutDashboard, Clock, CircleCheck, ClipboardList, Timer, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard - Administración" },
      { name: "description", content: "Panel administrativo del Área de Sistemas." },
    ],
  }),
  component: AdminDashboard,
});

type Sol = {
  id: string;
  estado: "en_espera" | "en_proceso" | "finalizado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
};

function AdminDashboard() {
  const [items, setItems] = useState<Sol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("solicitudes").select("id, estado, fecha_creacion, fecha_finalizacion");
      setItems((data as Sol[]) ?? []);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("admin-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const delDia = items.filter((s) => new Date(s.fecha_creacion).toDateString() === today).length;
    const pendientes = items.filter((s) => s.estado !== "finalizado").length;
    const finalizados = items.filter((s) => s.estado === "finalizado").length;
    const resueltas = items.filter((s) => s.estado === "finalizado" && s.fecha_finalizacion);
    const promedioMs =
      resueltas.length > 0
        ? resueltas.reduce(
            (acc, s) =>
              acc + (new Date(s.fecha_finalizacion!).getTime() - new Date(s.fecha_creacion).getTime()),
            0,
          ) / resueltas.length
        : 0;
    const promedioHoras = promedioMs / 3_600_000;
    return { delDia, pendientes, finalizados, total: items.length, promedioHoras };
  }, [items]);

  const cards = [
    { label: "Solicitudes del día", value: stats.delDia, icon: TrendingUp, color: "text-primary" },
    { label: "Pendientes", value: stats.pendientes, icon: Clock, color: "text-amber-400" },
    { label: "Finalizadas", value: stats.finalizados, icon: CircleCheck, color: "text-primary" },
    { label: "Total histórico", value: stats.total, icon: ClipboardList, color: "text-muted-foreground" },
    {
      label: "Tiempo promedio",
      value: stats.promedioHoras > 0 ? `${stats.promedioHoras.toFixed(1)} h` : "—",
      icon: Timer,
      color: "text-sky-400",
    },
  ];

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel administrativo</h1>
          <p className="text-sm text-muted-foreground">Indicadores del servicio de soporte técnico.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-3xl font-bold tracking-tight">
                {loading ? "—" : c.value}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-6">
        <h2 className="mb-1 text-lg font-semibold">Accesos rápidos</h2>
        <p className="text-sm text-muted-foreground">
          Usá el menú para gestionar solicitudes o explorar las estadísticas del área.
        </p>
      </Card>
    </AppShell>
  );
}
