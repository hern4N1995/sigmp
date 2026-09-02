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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  usuario_id: string | null;
  solicitante_area: string | null;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
};

function Estadisticas() {
  const [items, setItems] = useState<Sol[]>([]);
  const [areas, setAreas] = useState<Map<string, string>>(new Map());
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: catalogAreas }] = await Promise.all([
        supabase
          .from("solicitudes")
          .select("id, usuario_id, solicitante_area, urgencia, estado, fecha_creacion, fecha_finalizacion")
          .order("fecha_creacion", { ascending: true }),
        supabase.from("areas").select("id, nombre_corto").order("nombre_corto"),
      ]);
      const list = (data as Sol[]) ?? [];
      setItems(list);
      setAreaOptions((catalogAreas ?? []).map((area) => area.nombre_corto));
      const ids = Array.from(new Set(list.map((s) => s.usuario_id).filter((id): id is string => Boolean(id))));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, area, area_id").in("id", ids);
        const areaIds = Array.from(new Set((profs ?? []).map((profile) => profile.area_id).filter((id): id is string => Boolean(id))));
        const { data: areaRows } = areaIds.length
          ? await supabase.from("areas").select("id, nombre_corto").in("id", areaIds)
          : { data: [] };
        const areaMap = new Map((areaRows ?? []).map((area) => [area.id, area.nombre_corto]));
        const areaMapByUser = new Map((profs ?? []).map((p) => [p.id, p.area_id ? areaMap.get(p.area_id) ?? p.area ?? "Sin área" : p.area ?? "Sin área"]));
        // Crear mapa con IDs de usuarios y sus áreas, usando snapshot como fallback
        const allAreas = new Map<string, string>();
        list.forEach((s) => {
          if (s.usuario_id) {
            allAreas.set(s.usuario_id, areaMapByUser.get(s.usuario_id) ?? s.solicitante_area ?? "Sin área");
          }
        });
        setAreas(allAreas);
      } else {
        setAreas(new Map());
      }
    };
    load();
  }, []);

  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(items.map((item) => item.fecha_creacion.slice(0, 7)))).sort().reverse();
    return months.map((value) => ({
      value,
      label: new Date(`${value}-01T00:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    }));
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => {
      const matchesArea = areaFilter === "all" || (areas.get(item.usuario_id) ?? "Sin área") === areaFilter;
      const matchesMonth = monthFilter === "all" || item.fecha_creacion.slice(0, 7) === monthFilter;
      return matchesArea && matchesMonth;
    }),
    [items, areas, areaFilter, monthFilter],
  );

  const porDia = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((s) => {
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
  }, [filteredItems]);

  const porArea = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((s) => {
      const a = s.usuario_id ? areas.get(s.usuario_id) ?? "—" : s.solicitante_area ?? "—";
      map.set(a, (map.get(a) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([area, cantidad]) => ({ area, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  }, [filteredItems, areas]);

  const urgencias = useMemo(() => {
    const urgentes = filteredItems.filter((s) => s.urgencia === "urgente").length;
    const normales = filteredItems.length - urgentes;
    return [
      { name: "Urgente", value: urgentes, color: "oklch(0.65 0.22 25)" },
      { name: "Normal", value: normales, color: "oklch(0.72 0.17 155)" },
    ];
  }, [filteredItems]);

  const estados = useMemo(() => {
    const c = { en_espera: 0, en_proceso: 0, finalizado: 0, cancelado: 0, visto: 0 };
    filteredItems.forEach((s) => c[s.estado]++);
    return [
      { name: "En espera", value: c.en_espera, color: "oklch(0.75 0.15 80)" },
      { name: "En proceso", value: c.en_proceso, color: "oklch(0.65 0.17 240)" },
      { name: "Finalizado", value: c.finalizado, color: "oklch(0.72 0.17 155)" },
      { name: "Cancelado", value: c.cancelado, color: "oklch(0.65 0.22 25)" },
      { name: "Visto", value: c.visto, color: "oklch(0.68 0.02 155)" },
    ];
  }, [filteredItems]);

  const promedio = useMemo(() => {
    const r = filteredItems.filter((s) => s.estado === "finalizado" && s.fecha_finalizacion);
    if (!r.length) return 0;
    const total = r.reduce(
      (a, s) =>
        a + (new Date(s.fecha_finalizacion!).getTime() - new Date(s.fecha_creacion).getTime()),
      0,
    );
    return total / r.length / 3_600_000;
  }, [filteredItems]);

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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold">Solicitudes por día (últimos 14 días)</h2>
            <div className="w-full sm:w-48">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filtrar por mes</label>
              <Select modal={false} value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger><SelectValue placeholder="Todos los meses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {monthOptions.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold">Solicitudes por área</h2>
            <div className="w-full sm:w-48">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filtrar por área</label>
              <Select modal={false} value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger><SelectValue placeholder="Todas las áreas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las áreas</SelectItem>
                  {areaOptions.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
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
