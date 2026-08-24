import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas - Administración" },
      { name: "description", content: "Métricas del servicio de soporte técnico." },
    ],
  }),
  component: Estadisticas,
});

type Sol = {
  id: string;
  usuario_id: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
};

function Estadisticas() {
  const [items, setItems] = useState<Sol[]>([]);
  const [areas, setAreas] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("solicitudes")
        .select("id, usuario_id, urgencia, estado, fecha_creacion, fecha_finalizacion")
        .order("fecha_creacion", { ascending: true });
      const list = (data as Sol[]) ?? [];
      setItems(list);
      const ids = Array.from(new Set(list.map((s) => s.usuario_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, area").in("id", ids);
        setAreas(new Map((profs ?? []).map((p) => [p.id, p.area ?? "Sin área"])));
      }
    };
    load();
  }, []);

  const porDia = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const d = new Date(s.fecha_creacion).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort()
      .slice(-14)
      .map(([fecha, cantidad]) => ({
        fecha: new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
        cantidad,
      }));
  }, [items]);

  const porArea = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((s) => {
      const a = areas.get(s.usuario_id) ?? "—";
      map.set(a, (map.get(a) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([area, cantidad]) => ({ area, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  }, [items, areas]);

  const urgencias = useMemo(() => {
    const urgentes = items.filter((s) => s.urgencia === "urgente").length;
    const normales = items.length - urgentes;
    return [
      { name: "Urgente", value: urgentes, color: "oklch(0.65 0.22 25)" },
      { name: "Normal", value: normales, color: "oklch(0.72 0.17 155)" },
    ];
  }, [items]);

  const estados = useMemo(() => {
    const c = { en_espera: 0, en_proceso: 0, finalizado: 0 };
    items.forEach((s) => c[s.estado]++);
    return [
      { name: "En espera", value: c.en_espera, color: "oklch(0.75 0.15 80)" },
      { name: "En proceso", value: c.en_proceso, color: "oklch(0.65 0.17 240)" },
      { name: "Finalizado", value: c.finalizado, color: "oklch(0.72 0.17 155)" },
    ];
  }, [items]);

  const promedio = useMemo(() => {
    const r = items.filter((s) => s.estado === "finalizado" && s.fecha_finalizacion);
    if (!r.length) return 0;
    const total = r.reduce(
      (a, s) =>
        a + (new Date(s.fecha_finalizacion!).getTime() - new Date(s.fecha_creacion).getTime()),
      0,
    );
    return total / r.length / 3_600_000;
  }, [items]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-muted-foreground">Vista analítica de las solicitudes.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Solicitudes por día (últimos 14 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160)" />
                <XAxis dataKey="fecha" stroke="oklch(0.68 0.02 155)" fontSize={12} />
                <YAxis stroke="oklch(0.68 0.02 155)" fontSize={12} allowDecimals={false} />
                <Tooltip wrapperClassName="app-chart-tooltip" contentStyle={{ background: "var(--chart-tooltip-background)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, boxShadow: "var(--chart-tooltip-shadow)" }} labelStyle={{ color: "var(--chart-tooltip-foreground)" }} itemStyle={{ color: "var(--chart-tooltip-foreground)" }} />
                <Line type="monotone" dataKey="cantidad" stroke="oklch(0.72 0.17 155)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Solicitudes por área</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porArea} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160)" />
                <XAxis type="number" stroke="oklch(0.68 0.02 155)" fontSize={12} allowDecimals={false} />
                <YAxis dataKey="area" type="category" stroke="oklch(0.68 0.02 155)" fontSize={12} width={100} />
                <Tooltip wrapperClassName="app-chart-tooltip" contentStyle={{ background: "var(--chart-tooltip-background)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, boxShadow: "var(--chart-tooltip-shadow)" }} labelStyle={{ color: "var(--chart-tooltip-foreground)" }} itemStyle={{ color: "var(--chart-tooltip-foreground)" }} />
                <Bar dataKey="cantidad" fill="oklch(0.72 0.17 155)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribución por urgencia</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={urgencias} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                  {urgencias.map((e, i) => (<Cell key={i} fill={e.color} />))}
                </Pie>
                <Legend />
                <Tooltip wrapperClassName="app-chart-tooltip" contentStyle={{ background: "var(--chart-tooltip-background)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, boxShadow: "var(--chart-tooltip-shadow)" }} labelStyle={{ color: "var(--chart-tooltip-foreground)" }} itemStyle={{ color: "var(--chart-tooltip-foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribución por estado</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={estados} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                  {estados.map((e, i) => (<Cell key={i} fill={e.color} />))}
                </Pie>
                <Legend />
                <Tooltip wrapperClassName="app-chart-tooltip" contentStyle={{ background: "var(--chart-tooltip-background)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8, boxShadow: "var(--chart-tooltip-shadow)" }} labelStyle={{ color: "var(--chart-tooltip-foreground)" }} itemStyle={{ color: "var(--chart-tooltip-foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Tiempo promedio de resolución</h2>
          <div className="mt-2 text-4xl font-bold tracking-tight text-primary">
            {promedio > 0 ? `${promedio.toFixed(1)} horas` : "Sin datos aún"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Promedio calculado sobre solicitudes finalizadas.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
