import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUnidadDescendantIds, type UnidadNode } from "@/lib/unidades";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
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
  LabelList,
} from "recharts";
import { BarChart3, Check, ChevronsUpDown, Download, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas - SIG" },
      { name: "description", content: "Métricas del servicio de soporte técnico." },
    ],
  }),
  component: Estadisticas,
});

type Sol = {
  id: string;
  usuario_id: string | null;
  unidad_id: string | null;
  unidad_nombre_snapshot: string | null;
  solicitante_nombre: string | null;
  solicitante_email: string | null;
  motivo: string;
  descripcion: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto" | "pausado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
};

const REPORT_DESKTOP_PAGE_SIZE = 10;
const REPORT_MOBILE_PAGE_SIZE = 3;
type ProfileUnit = { unidad_id: string | null; es_jefe: boolean };

type FilterOption = {
  value: string;
  label: string;
  searchText?: string;
};

function FilterCombobox({
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: FilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(optionValue, search) => {
            const option = options.find((candidate) => candidate.value === optionValue);
            const searchableText = `${option?.label ?? ""} ${option?.searchText ?? ""}`;
            return normalize(searchableText).includes(normalize(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={
                    value === option.value ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"
                  }
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function getLocalDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unitMatchesFilters(
  dependencyId: string,
  unitId: string,
  assignedUnitId: string | undefined,
  units: UnidadNode[],
) {
  if (!assignedUnitId) return dependencyId === "all" && unitId === "all";
  const matchesDependency =
    dependencyId === "all" || getUnidadDescendantIds(dependencyId, units).has(assignedUnitId);
  return matchesDependency && (unitId === "all" || assignedUnitId === unitId);
}

function getTicketUnitLabel(
  item: Sol,
  profilesByUser: Map<string, ProfileUnit>,
  unitsById: Map<string, UnidadNode>,
) {
  const profile = item.usuario_id ? profilesByUser.get(item.usuario_id) : undefined;
  const unitId = item.unidad_id ?? profile?.unidad_id;
  const unit = unitId ? unitsById.get(unitId) : undefined;
  if (profile?.es_jefe && unit) return unit.cargo_jefe;
  return item.unidad_nombre_snapshot ?? unit?.ruta ?? "Sin unidad";
}

function Estadisticas() {
  const isMobile = useIsMobile();
  const reportPageSize = isMobile ? REPORT_MOBILE_PAGE_SIZE : REPORT_DESKTOP_PAGE_SIZE;
  const [items, setItems] = useState<Sol[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [profilesByUser, setProfilesByUser] = useState<Map<string, ProfileUnit>>(new Map());
  const [unitOptions, setUnitOptions] = useState<UnidadNode[]>([]);
  const [dependencyFilter, setDependencyFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportDependency, setReportDependency] = useState("all");
  const [reportArea, setReportArea] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportUrgency, setReportUrgency] = useState("all");
  const [reportPage, setReportPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      const [{ data, error: requestsError }, { data: catalogUnits, error: unitsError }] =
        await Promise.all([
          supabase
            .from("solicitudes")
            .select(
              "id, usuario_id, unidad_id, unidad_nombre_snapshot, solicitante_nombre, solicitante_email, motivo, descripcion, urgencia, estado, fecha_creacion, fecha_finalizacion",
            )
            .order("fecha_creacion", { ascending: true }),
          supabase.from("unidades_arbol").select("*").order("orden"),
        ]);
      if (requestsError) {
        toast.error(`No se pudieron cargar las solicitudes: ${requestsError.message}`);
        return;
      }
      if (unitsError) {
        toast.error(
          `No se pudo cargar el organigrama: ${unitsError.message}. Aplicá las migraciones de unidades en Supabase.`,
        );
        return;
      }
      const list = (data as Sol[]) ?? [];
      const catalog = (catalogUnits ?? []) as UnidadNode[];
      setItems(list);
      setUnitOptions(catalog);
      const ids = Array.from(
        new Set(list.map((s) => s.usuario_id).filter((id): id is string => Boolean(id))),
      );
      if (ids.length) {
        const { data: profs, error: profilesError } = await supabase
          .from("profiles")
          .select("id, unidad_id, es_jefe")
          .in("id", ids);
        if (profilesError) {
          toast.error(`No se pudieron cargar los perfiles: ${profilesError.message}`);
          return;
        }
        setProfilesByUser(
          new Map(
            (profs ?? []).map((profile) => [
              profile.id,
              { unidad_id: profile.unidad_id, es_jefe: profile.es_jefe },
            ]),
          ),
        );
      } else {
        setProfilesByUser(new Map());
      }
    };
    void load()
      .catch((error: unknown) => {
        console.error("No se pudieron cargar las estadísticas.", error);
        toast.error("No se pudieron cargar las estadísticas. Intentá nuevamente.");
      })
      .finally(() => setLoading(false));
  }, []);

  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(items.map((item) => item.fecha_creacion.slice(0, 7))))
      .sort()
      .reverse();
    return months.map((value) => ({
      value,
      label: new Date(`${value}-01T00:00:00`).toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      }),
    }));
  }, [items]);

  const dependencyOptions = useMemo(
    () =>
      unitOptions.filter((unit) => unitOptions.some((candidate) => candidate.padre_id === unit.id)),
    [unitOptions],
  );
  const chartUnitOptions = useMemo(
    () =>
      dependencyFilter === "all"
        ? unitOptions
        : unitOptions.filter((unit) =>
            getUnidadDescendantIds(dependencyFilter, unitOptions).has(unit.id),
          ),
    [unitOptions, dependencyFilter],
  );
  const reportUnitOptions = useMemo(
    () =>
      reportDependency === "all"
        ? unitOptions
        : unitOptions.filter((unit) =>
            getUnidadDescendantIds(reportDependency, unitOptions).has(unit.id),
          ),
    [unitOptions, reportDependency],
  );
  const dependencyFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "Todas las dependencias" },
      ...dependencyOptions.map((unit) => ({
        value: unit.id,
        label: unit.ruta,
        searchText: unit.ruta,
      })),
    ],
    [dependencyOptions],
  );
  const chartUnitFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "Todas las unidades" },
      ...chartUnitOptions.map((unit) => ({
        value: unit.id,
        label: unit.nombre,
        searchText: unit.ruta,
      })),
    ],
    [chartUnitOptions],
  );
  const reportDependencyFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "Todas las dependencias" },
      ...dependencyOptions.map((unit) => ({
        value: unit.id,
        label: unit.ruta,
        searchText: unit.ruta,
      })),
    ],
    [dependencyOptions],
  );
  const reportUnitFilterOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "Todas las unidades" },
      ...reportUnitOptions.map((unit) => ({
        value: unit.id,
        label: unit.nombre,
        searchText: unit.ruta,
      })),
    ],
    [reportUnitOptions],
  );
  const unitsById = useMemo(
    () => new Map(unitOptions.map((unit) => [unit.id, unit])),
    [unitOptions],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const assignedUnitId =
          item.unidad_id ??
          (item.usuario_id ? profilesByUser.get(item.usuario_id)?.unidad_id : undefined);
        const matchesUnit = unitMatchesFilters(
          dependencyFilter,
          areaFilter,
          assignedUnitId ?? undefined,
          unitOptions,
        );
        const matchesMonth =
          monthFilter === "all" || item.fecha_creacion.slice(0, 7) === monthFilter;
        return matchesUnit && matchesMonth;
      }),
    [items, profilesByUser, unitOptions, dependencyFilter, areaFilter, monthFilter],
  );

  const reportItems = useMemo(
    () =>
      items
        .filter((item) => {
          const assignedUnitId =
            item.unidad_id ??
            (item.usuario_id ? profilesByUser.get(item.usuario_id)?.unidad_id : undefined);
          const matchesUnit = unitMatchesFilters(
            reportDependency,
            reportArea,
            assignedUnitId ?? undefined,
            unitOptions,
          );
          const date = getLocalDateKey(item.fecha_creacion);
          return (
            (!reportStartDate || date >= reportStartDate) &&
            (!reportEndDate || date <= reportEndDate) &&
            matchesUnit &&
            (reportStatus === "all" || item.estado === reportStatus) &&
            (reportUrgency === "all" || item.urgencia === reportUrgency)
          );
        })
        .sort(
          (a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime(),
        ),
    [
      items,
      profilesByUser,
      unitOptions,
      reportStartDate,
      reportEndDate,
      reportDependency,
      reportArea,
      reportStatus,
      reportUrgency,
    ],
  );

  useEffect(() => {
    setReportPage(1);
  }, [
    reportStartDate,
    reportEndDate,
    reportDependency,
    reportArea,
    reportStatus,
    reportUrgency,
    isMobile,
  ]);

  const reportTotalPages = Math.ceil(reportItems.length / reportPageSize);
  const paginatedReportItems = reportItems.slice(
    (reportPage - 1) * reportPageSize,
    reportPage * reportPageSize,
  );

  const exportReport = async () => {
    setExporting(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
    const headers = [
      "ID",
      "Fecha",
      "Solicitante",
      "Correo",
      "Unidad",
      "Motivo",
      "Descripción",
      "Urgencia",
      "Estado",
    ];
    const rows = reportItems.map((item) => [
      item.id,
      new Date(item.fecha_creacion).toLocaleString("es-AR"),
      item.solicitante_nombre ?? "—",
      item.solicitante_email ?? "—",
      getTicketUnitLabel(item, profilesByUser, unitsById),
      item.motivo,
      item.descripcion,
      item.urgencia === "urgente" ? "Urgente" : "Normal",
      item.estado.replaceAll("_", " "),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "informe-solicitudes.csv";
    link.click();
    URL.revokeObjectURL(url);
      toast.success("El informe se descargó correctamente.");
    } catch (error) {
      console.error("No se pudo exportar el informe de solicitudes.", error);
      toast.error("No se pudo exportar el informe. Intentá nuevamente.");
    } finally {
      setExporting(false);
    }
  };

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

  const porUnidad = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((s) => {
      const unidad = getTicketUnitLabel(s, profilesByUser, unitsById);
      map.set(unidad, (map.get(unidad) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([unidad, cantidad]) => ({ unidad, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  }, [filteredItems, profilesByUser, unitsById]);

  const urgencias = useMemo(() => {
    const urgentes = filteredItems.filter((s) => s.urgencia === "urgente").length;
    const normales = filteredItems.length - urgentes;
    return [
      { name: "Urgente", value: urgentes, color: "oklch(0.65 0.22 25)" },
      { name: "Normal", value: normales, color: "oklch(0.72 0.17 155)" },
    ];
  }, [filteredItems]);

  const estados = useMemo(() => {
    const c = { en_espera: 0, en_proceso: 0, pausado: 0, finalizado: 0, cancelado: 0, visto: 0 };
    filteredItems.forEach((s) => c[s.estado]++);
    return [
      { name: "En espera", value: c.en_espera, color: "oklch(0.75 0.15 80)" },
      { name: "En proceso", value: c.en_proceso, color: "oklch(0.65 0.17 240)" },
      { name: "Pausado", value: c.pausado, color: "oklch(0.72 0.13 70)" },
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

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          title="Estadísticas"
          description="Vista analítica de las solicitudes."
          icon={BarChart3}
        />
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Cargando estadísticas">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="space-y-4 p-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </Card>
          ))}
          <Card className="space-y-4 p-5 lg:col-span-2">
            <Skeleton className="h-6 w-48" />
            <div className="space-y-3">
              {Array.from({ length: isMobile ? 3 : 7 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Estadísticas"
        description="Vista analítica de las solicitudes."
        icon={BarChart3}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Dependencia para gráficos (incluye subordinadas)
            </label>
            <FilterCombobox
              value={dependencyFilter}
              onValueChange={(value) => {
                setDependencyFilter(value);
                setAreaFilter("all");
              }}
              placeholder="Todas las dependencias"
              searchPlaceholder="Buscar dependencia..."
              emptyMessage="No se encontraron dependencias."
              options={dependencyFilterOptions}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Unidad para gráficos
            </label>
            <FilterCombobox
              value={areaFilter}
              onValueChange={setAreaFilter}
              placeholder="Todas las unidades"
              searchPlaceholder="Buscar unidad o dependencia..."
              emptyMessage="No se encontraron unidades."
              options={chartUnitFilterOptions}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Mes para gráficos
            </label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setDependencyFilter("all");
              setAreaFilter("all");
              setMonthFilter("all");
            }}
            disabled={dependencyFilter === "all" && areaFilter === "all" && monthFilter === "all"}
          >
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Solicitudes por día (últimos 14 días)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porDia} margin={{ top: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160)" />
                <XAxis dataKey="fecha" stroke="oklch(0.68 0.02 155)" fontSize={12} />
                <YAxis stroke="oklch(0.68 0.02 155)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  wrapperClassName="app-chart-tooltip"
                  contentStyle={{
                    background: "var(--chart-tooltip-background)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: 8,
                    boxShadow: "var(--chart-tooltip-shadow)",
                  }}
                  labelStyle={{ color: "var(--chart-tooltip-foreground)" }}
                  itemStyle={{ color: "var(--chart-tooltip-foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="cantidad"
                  stroke="oklch(0.72 0.17 155)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                >
                  <LabelList
                    dataKey="cantidad"
                    position="top"
                    fill="var(--chart-value-foreground)"
                    fontSize={14}
                    style={{ fontWeight: 700 }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Solicitudes por unidad</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porUnidad} layout="vertical" margin={{ right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 160)" />
                <XAxis
                  type="number"
                  stroke="oklch(0.68 0.02 155)"
                  fontSize={12}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="unidad"
                  type="category"
                  stroke="oklch(0.68 0.02 155)"
                  fontSize={12}
                  width={100}
                />
                <Tooltip
                  wrapperClassName="app-chart-tooltip"
                  cursor={{ fill: "var(--chart-cursor-background)" }}
                  contentStyle={{
                    background: "var(--chart-tooltip-background)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: 8,
                    boxShadow: "var(--chart-tooltip-shadow)",
                  }}
                  labelStyle={{ color: "var(--chart-tooltip-foreground)" }}
                  itemStyle={{ color: "var(--chart-tooltip-foreground)" }}
                />
                <Bar dataKey="cantidad" fill="oklch(0.72 0.17 155)" radius={[0, 6, 6, 0]}>
                  <LabelList
                    dataKey="cantidad"
                    position="right"
                    fill="var(--chart-value-foreground)"
                    fontSize={14}
                    style={{ fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribución por urgencia</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={urgencias.filter((slice) => slice.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {urgencias
                    .filter((slice) => slice.value > 0)
                    .map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  <LabelList
                    dataKey="value"
                    position="inside"
                    fill="#000"
                    stroke="none"
                    style={{ fill: "#000", fontWeight: 700 }}
                    fontSize={16}
                  />
                </Pie>
                <Legend />
                <Tooltip
                  wrapperClassName="app-chart-tooltip"
                  contentStyle={{
                    background: "var(--chart-tooltip-background)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: 8,
                    boxShadow: "var(--chart-tooltip-shadow)",
                  }}
                  labelStyle={{ color: "var(--chart-tooltip-foreground)" }}
                  itemStyle={{ color: "var(--chart-tooltip-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribución por estado</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={estados.filter((slice) => slice.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {estados
                    .filter((slice) => slice.value > 0)
                    .map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  <LabelList
                    dataKey="value"
                    position="inside"
                    fill="#000"
                    stroke="none"
                    style={{ fill: "#000", fontWeight: 700 }}
                    fontSize={16}
                  />
                </Pie>
                <Legend />
                <Tooltip
                  wrapperClassName="app-chart-tooltip"
                  contentStyle={{
                    background: "var(--chart-tooltip-background)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: 8,
                    boxShadow: "var(--chart-tooltip-shadow)",
                  }}
                  labelStyle={{ color: "var(--chart-tooltip-foreground)" }}
                  itemStyle={{ color: "var(--chart-tooltip-foreground)" }}
                />
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

        <Card className="p-5 lg:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Informe de solicitudes</h2>
              <p className="text-sm text-muted-foreground">
                {reportItems.length} solicitudes encontradas
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={exportReport}
              disabled={!reportItems.length || exporting}
              className="gap-2"
            >
              {exporting ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <div>
              <label
                htmlFor="report-start-date"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Desde
              </label>
              <Input
                id="report-start-date"
                type="date"
                value={reportStartDate}
                max={reportEndDate || undefined}
                onChange={(event) => setReportStartDate(event.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="report-end-date"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Hasta
              </label>
              <Input
                id="report-end-date"
                type="date"
                value={reportEndDate}
                min={reportStartDate || undefined}
                onChange={(event) => setReportEndDate(event.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Dependencia (incluye subordinadas)
              </label>
              <FilterCombobox
                value={reportDependency}
                onValueChange={(value) => {
                  setReportDependency(value);
                  setReportArea("all");
                }}
                placeholder="Todas las dependencias"
                searchPlaceholder="Buscar dependencia..."
                emptyMessage="No se encontraron dependencias."
                options={reportDependencyFilterOptions}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Unidad
              </label>
              <FilterCombobox
                value={reportArea}
                onValueChange={setReportArea}
                placeholder="Todas las unidades"
                searchPlaceholder="Buscar unidad o dependencia..."
                emptyMessage="No se encontraron unidades."
                options={reportUnitFilterOptions}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Estado
              </label>
              <Select value={reportStatus} onValueChange={setReportStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="en_espera">En espera</SelectItem>
                  <SelectItem value="en_proceso">En proceso</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="visto">Visto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Urgencia
              </label>
              <Select value={reportUrgency} onValueChange={setReportUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full self-end"
              onClick={() => {
                setReportStartDate("");
                setReportEndDate("");
                setReportDependency("all");
                setReportArea("all");
                setReportStatus("all");
                setReportUrgency("all");
              }}
              disabled={
                !reportStartDate &&
                !reportEndDate &&
                reportDependency === "all" &&
                reportArea === "all" &&
                reportStatus === "all" &&
                reportUrgency === "all"
              }
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          </div>

          <div className="hidden max-h-[32rem] overflow-auto rounded-md border md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Solicitante</th>
                  <th className="px-3 py-2 font-medium">Unidad</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Urgencia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedReportItems.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-3 py-2">
                      {new Date(item.fecha_creacion).toLocaleString("es-AR")}
                    </td>
                    <td className="px-3 py-2">
                      {item.solicitante_nombre ?? item.solicitante_email ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {getTicketUnitLabel(item, profilesByUser, unitsById)}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2" title={item.motivo}>
                      {item.motivo}
                    </td>
                    <td className="px-3 py-2">
                      {item.urgencia === "urgente" ? "Urgente" : "Normal"}
                    </td>
                    <td className="px-3 py-2 capitalize">{item.estado.replaceAll("_", " ")}</td>
                  </tr>
                ))}
                {!reportItems.length && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <EmptyState
                        title="No hay resultados para estos filtros"
                        description="Probá con otros criterios o limpiá los filtros del informe."
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReportStartDate("");
                              setReportEndDate("");
                              setReportDependency("all");
                              setReportArea("all");
                              setReportStatus("all");
                              setReportUrgency("all");
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {paginatedReportItems.map((item) => (
              <article
                key={item.id}
                className="min-w-0 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <time className="text-xs text-muted-foreground">
                    {new Date(item.fecha_creacion).toLocaleString("es-AR")}
                  </time>
                  <EstadoBadge value={item.estado} />
                </div>
                <h3 className="mt-2 break-words font-semibold">
                  {item.solicitante_nombre ?? item.solicitante_email ?? "Solicitante sin nombre"}
                </h3>
                {item.solicitante_nombre && item.solicitante_email && (
                  <p className="mt-0.5 break-all text-sm text-muted-foreground">
                    {item.solicitante_email}
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Unidad</dt>
                    <dd className="break-words">
                      {getTicketUnitLabel(item, profilesByUser, unitsById)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Urgencia</dt>
                    <dd className="mt-1">
                      <UrgenciaBadge value={item.urgencia} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="break-words text-sm font-medium">{item.motivo}</p>
                  <p className="mt-2 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                    {item.descripcion}
                  </p>
                </div>
              </article>
            ))}
            {!reportItems.length && (
              <EmptyState
                title="No hay resultados para estos filtros"
                description="Probá con otros criterios o limpiá los filtros del informe."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReportStartDate("");
                      setReportEndDate("");
                      setReportDependency("all");
                      setReportArea("all");
                      setReportStatus("all");
                      setReportUrgency("all");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                }
              />
            )}
          </div>
          {reportTotalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {(reportPage - 1) * reportPageSize + 1}-
                {Math.min(reportPage * reportPageSize, reportItems.length)} de {reportItems.length}{" "}
                solicitudes
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={reportPage === 1}
                  onClick={() => setReportPage((page) => Math.max(1, page - 1))}
                >
                  Anterior
                </Button>
                {Array.from({ length: Math.min(5, reportTotalPages) }, (_, index) => {
                  const page = reportPage > 3 ? reportPage - 2 + index : index + 1;
                  if (page > reportTotalPages) return null;
                  return (
                    <Button
                      key={page}
                      type="button"
                      size="sm"
                      variant={page === reportPage ? "default" : "outline"}
                      onClick={() => setReportPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={reportPage === reportTotalPages}
                  onClick={() => setReportPage((page) => Math.min(reportTotalPages, page + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
