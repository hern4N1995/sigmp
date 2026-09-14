import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";
import { ClipboardList, Search, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin/solicitudes")({
  head: () => ({
    meta: [
      { title: "Gestión de solicitudes - Administración" },
      { name: "description", content: "Listado completo de solicitudes de soporte." },
    ],
  }),
  component: AdminSolicitudes,
});

type Row = {
  asignado_a: string | null;
  colaborador_id: string | null;
  id: string;
  usuario_id: string | null;
  solicitante_nombre: string | null;
  solicitante_email: string | null;
  solicitante_area: string | null;
  motivo: string;
  descripcion: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto" | "pausado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
  motivo_cancelacion: string | null;
  motivo_pausa_id: string | null;
  motivo_pausa_detalle: string | null;
  resolucion: string | null;
  profile?: { nombre: string | null; apellido: string | null; area: string | null; email: string | null };
  responsable?: Person;
  colaborador?: Person;
  motivo_pausa?: { id: string; descripcion: string; orden: number };
};

type MotivosPausa = {
  id: string;
  descripcion: string;
  orden: number;
};

type Person = { nombre: string | null; apellido: string | null; email: string | null };

const ITEMS_PER_PAGE = 15;

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
};

function AdminSolicitudes() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"current" | "historic">("current");
  const [currentPage, setCurrentPage] = useState(1);
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const [itemsCurrentMonth, setItemsCurrentMonth] = useState<Row[]>([]);
  const [itemsHistoric, setItemsHistoric] = useState<Row[]>([]);
  const [totalCurrentMonth, setTotalCurrentMonth] = useState(0);
  const [totalHistoric, setTotalHistoric] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);

  const [admins, setAdmins] = useState<Array<{ id: string } & Person>>([]);
  const [motivos, setMotivos] = useState<MotivosPausa[]>([]);

  const [detail, setDetail] = useState<Row | null>(null);
  const [pendingFinalization, setPendingFinalization] = useState<Row | null>(null);
  const [collaboratorId, setCollaboratorId] = useState("none");
  const [finalizationComment, setFinalizationComment] = useState("");
  const [pendingPause, setPendingPause] = useState<Row | null>(null);
  const [selectedPauseReason, setSelectedPauseReason] = useState<string>("");
  const [customPauseDetail, setCustomPauseDetail] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadCurrentMonth = async (page: number) => {
    try {
      const { startISO, endISO } = getMonthRange();
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("solicitudes")
        .select("*", { count: "exact" })
        .gte("fecha_creacion", startISO)
        .lte("fecha_creacion", endISO)
        .order("fecha_creacion", { ascending: false });

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine) {
        query = query.eq("asignado_a", user?.id);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: (data as Row[]) ?? [],
        totalRecords: count ?? 0,
      };
    } catch (error) {
      toast.error("Error al cargar solicitudes");
      return { data: [], totalRecords: 0 };
    }
  };

  const loadHistoric = async (page: number) => {
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("solicitudes")
        .select("*", { count: "exact" })
        .order("fecha_creacion", { ascending: false });

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine) {
        query = query.eq("asignado_a", user?.id);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: (data as Row[]) ?? [],
        totalRecords: count ?? 0,
      };
    } catch (error) {
      toast.error("Error al cargar histórico");
      return { data: [], totalRecords: 0 };
    }
  };

  const enrichRows = async (rows: Row[]) => {
    if (!rows.length) return rows;

    const ids = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.usuario_id, r.asignado_a, r.colaborador_id])
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, area, area_id, email")
        .in("id", ids);

      const areaIds = Array.from(new Set((profs ?? []).map((profile) => profile.area_id).filter((id): id is string => Boolean(id))));
      const { data: areaRows } = areaIds.length
        ? await supabase.from("areas").select("id, nombre_corto").in("id", areaIds)
        : { data: [] };

      const areaMap = new Map((areaRows ?? []).map((area) => [area.id, area.nombre_corto]));
      const map = new Map((profs ?? []).map((p) => [p.id, p]));

      rows.forEach((r) => {
        r.profile = map.get(r.usuario_id) as any;
        if (r.profile?.area_id) r.profile.area = areaMap.get(r.profile.area_id) ?? r.profile.area;
        r.responsable = r.asignado_a ? map.get(r.asignado_a) : undefined;
        r.colaborador = r.colaborador_id ? map.get(r.colaborador_id) : undefined;
      });
    }

    const pausedRows = rows.filter((r) => r.estado === "pausado" && r.motivo_pausa_id);
    if (pausedRows.length) {
      const motivoIds = Array.from(new Set(pausedRows.map((r) => r.motivo_pausa_id).filter((id): id is string => Boolean(id))));
      if (motivoIds.length) {
        const { data: motivosDataDetail } = await supabase.from("motivos_pausa").select("*").in("id", motivoIds);
        const motivoMap = new Map((motivosDataDetail ?? []).map((m) => [m.id, m]));
        pausedRows.forEach((r) => {
          if (r.motivo_pausa_id) r.motivo_pausa = motivoMap.get(r.motivo_pausa_id);
        });
      }
    }

    return rows;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [motivosData, adminRoles] = await Promise.all([
        supabase.from("motivos_pausa").select("*").order("orden"),
        supabase.from("user_roles").select("user_id").eq("role", "administrador"),
      ]);

      setMotivos((motivosData.data ?? []) as MotivosPausa[]);

      const adminIds = (adminRoles.data ?? []).map((r: any) => r.user_id).filter((id) => id !== user?.id);
      if (adminIds.length) {
        const { data: adminProfiles } = await supabase.from("profiles").select("id, nombre, apellido, email").in("id", adminIds);
        setAdmins((adminProfiles ?? []) as Array<{ id: string } & Person>);
      }

      setLoading(false);
    };

    loadData();
  }, [user?.id]);

  useEffect(() => {
    const loadPage = async () => {
      setLoadingPage(true);
      if (viewMode === "current") {
        const { data, totalRecords } = await loadCurrentMonth(currentPage);
        const enriched = await enrichRows(data);
        setItemsCurrentMonth(enriched);
        setTotalCurrentMonth(totalRecords);
      } else {
        const { data, totalRecords } = await loadHistoric(currentPage);
        const enriched = await enrichRows(data);
        setItemsHistoric(enriched);
        setTotalHistoric(totalRecords);
      }
      setLoadingPage(false);
    };

    loadPage();
  }, [viewMode, currentPage, filterEstado, onlyMine, user?.id, refreshTrigger]);

  const displayData = useMemo(() => {
    const source = viewMode === "current" ? itemsCurrentMonth : itemsHistoric;
    if (!q) return source;

    const s = q.toLowerCase();
    return source.filter(
      (r) =>
        r.motivo.toLowerCase().includes(s) ||
        (r.profile?.nombre ?? "").toLowerCase().includes(s) ||
        (r.profile?.apellido ?? "").toLowerCase().includes(s) ||
        (r.solicitante_nombre ?? "").toLowerCase().includes(s) ||
        (r.solicitante_email ?? "").toLowerCase().includes(s) ||
        (r.profile?.area ?? "").toLowerCase().includes(s),
    );
  }, [itemsCurrentMonth, itemsHistoric, q, viewMode]);

  const totalRecords = viewMode === "current" ? totalCurrentMonth : totalHistoric;
  const totalPages = Math.ceil(totalRecords / ITEMS_PER_PAGE);

  const changeEstado = async (id: string, estado: Row["estado"], selectedCollaboratorId: string | null = null, resolucion: string | null = null) => {
    const { error } = await supabase
      .from("solicitudes")
      .update({
        estado,
        ...(estado === "finalizado" ? { colaborador_id: selectedCollaboratorId, resolucion } : {}),
      })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Estado actualizado");
      setCurrentPage(1);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const requestEstadoChange = (row: Row, estado: Row["estado"]) => {
    if (estado === "pausado" && row.estado === "en_proceso") {
      setPendingPause(row);
      setSelectedPauseReason("");
      setCustomPauseDetail("");
      return;
    }
    if (estado === "finalizado" && row.estado !== "finalizado" && row.estado !== "pausado") {
      setPendingFinalization(row);
      setCollaboratorId("none");
      setFinalizationComment("");
      return;
    }
    void changeEstado(row.id, estado);
  };

  const confirmPause = async () => {
    if (!pendingPause || !selectedPauseReason) return;
    const selectedMotivo = motivos.find((m) => m.id === selectedPauseReason);
    if (!selectedMotivo) return;
    if (selectedMotivo.descripcion === "Otro" && !customPauseDetail.trim()) return;

    const { error } = await supabase
      .from("solicitudes")
      .update({
        estado: "pausado",
        motivo_pausa_id: selectedPauseReason,
        motivo_pausa_detalle: selectedMotivo.descripcion === "Otro" ? customPauseDetail : null,
      })
      .eq("id", pendingPause.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Solicitud pausada");
      setPendingPause(null);
      setCurrentPage(1);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  const confirmFinalization = async () => {
    if (!pendingFinalization) return;
    await changeEstado(pendingFinalization.id, "finalizado", collaboratorId === "none" ? null : collaboratorId, finalizationComment || null);
    setPendingFinalization(null);
  };

  const exportToCSV = async () => {
    try {
      setLoading(true);
      let query = supabase.from("solicitudes").select("*").order("fecha_creacion", { ascending: false });

      if (viewMode === "current") {
        const { startISO, endISO } = getMonthRange();
        query = query.gte("fecha_creacion", startISO).lte("fecha_creacion", endISO);
      }

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine) {
        query = query.eq("asignado_a", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.warning("No hay registros para exportar");
        return;
      }

      // Enriquecer datos
      const enriched = await enrichRows((data as Row[]) ?? []);

      // Convertir a CSV
      const headers = ["Fecha", "Empleado", "Área", "Motivo", "Urgencia", "Estado", "Responsable", "Descripción"];
      const rows = enriched.map((r) => [
        new Date(r.fecha_creacion).toLocaleString("es-AR"),
        `${r.profile?.nombre ?? r.solicitante_nombre ?? ""} ${r.profile?.apellido ?? ""}`.trim(),
        r.profile?.area ?? r.solicitante_area ?? "Sin área",
        r.motivo,
        r.urgencia,
        r.estado,
        r.responsable?.nombre ?? "-",
        r.descripcion,
      ]);

      const csv = [headers.map((h) => `"${h}"`).join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");

      // Descargar
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `solicitudes-${new Date().toISOString().split("T")[0]}.csv`);
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exportados ${enriched.length} registros`);
    } catch (error) {
      toast.error("Error al exportar");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const fullName = (profile?: any, solicitanteName?: string | null) => {
    if (profile?.nombre) return `${profile.nombre} ${profile.apellido ?? ""}`.trim();
    return solicitanteName ?? "Usuario eliminado";
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes</h1>
          <p className="text-sm text-muted-foreground">Gestioná todos los pedidos recibidos.</p>
        </div>
      </div>

      <Card className="p-4">
        {/* View Mode Toggle */}
        <div className="mb-4 flex gap-2 border-b border-border pb-4">
          <Button
            variant={viewMode === "current" ? "default" : "outline"}
            onClick={() => {
              setViewMode("current");
              setCurrentPage(1);
            }}
            size="sm"
          >
            Mes actual
          </Button>
          <Button
            variant={viewMode === "historic" ? "default" : "outline"}
            onClick={() => {
              setViewMode("historic");
              setCurrentPage(1);
            }}
            size="sm"
          >
            Histórico
          </Button>
          {viewMode === "historic" && (
            <Button variant="outline" size="sm" onClick={exportToCSV} className="ml-auto gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por motivo, empleado o área..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="sm:w-48">
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
          <Button type="button" variant={onlyMine ? "default" : "outline"} onClick={() => setOnlyMine((value) => !value)}>
            Mis solicitudes
          </Button>
        </div>

        {/* Loading */}
        {loadingPage ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : displayData.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sin resultados.</div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Empleado</th>
                    <th className="px-3 py-2 font-medium">Área</th>
                    <th className="px-3 py-2 font-medium">Motivo</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayData.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetail(r)}>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(r.fecha_creacion)}</td>
                      <td className="px-3 py-3 font-medium">{fullName(r.profile, r.solicitante_nombre)}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{r.profile?.area ?? r.solicitante_area ?? "Sin área"}</td>
                      <td className="max-w-xs truncate px-3 py-3 text-sm">{r.motivo}</td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={r.estado} onValueChange={(v) => requestEstadoChange(r, v as Row["estado"])}>
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {r.estado === "cancelado" ? (
                              <SelectItem value="visto">Visto</SelectItem>
                            ) : r.estado === "visto" ? (
                              <SelectItem value="visto">Visto</SelectItem>
                            ) : r.estado === "pausado" ? (
                              <>
                                <SelectItem value="pausado">Pausado</SelectItem>
                                <SelectItem value="en_proceso">Retomar</SelectItem>
                                <SelectItem value="finalizado">Finalizar</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="en_espera">En espera</SelectItem>
                                <SelectItem value="en_proceso">En proceso</SelectItem>
                                {r.estado === "en_proceso" && <SelectItem value="pausado">Pausar</SelectItem>}
                                <SelectItem value="finalizado">Finalizado</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetail(r)}>
                            Ver
                          </Button>
                          {r.estado !== "finalizado" && r.estado !== "visto" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => requestEstadoChange(r, r.estado === "cancelado" ? "visto" : "finalizado")}
                            >
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="space-y-3 md:hidden">
              {displayData.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{formatDate(r.fecha_creacion)}</div>
                      <div className="font-medium">{fullName(r.profile, r.solicitante_nombre)}</div>
                    </div>
                    <UrgenciaBadge value={r.urgencia} />
                  </div>
                  <div className="mb-3 space-y-1 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Área: </span>
                      {r.profile?.area ?? r.solicitante_area ?? "Sin área"}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Motivo: </span>
                      {r.motivo}
                    </div>
                  </div>
                  <div className="mb-3 flex gap-2">
                    <EstadoBadge value={r.estado} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetail(r)}>
                      Ver
                    </Button>
                    {r.estado !== "finalizado" && r.estado !== "visto" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestEstadoChange(r, r.estado === "cancelado" ? "visto" : "finalizado")}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({totalRecords} registros)
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  >
                    Anterior
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1;
                    if (pageNum > totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={pageNum === currentPage ? "default" : "outline"}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* DETAIL DIALOG */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{detail?.motivo}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <UrgenciaBadge value={detail.urgencia} />
                <EstadoBadge value={detail.estado} />
              </div>
              <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Empleado</div>
                  <div className="break-words font-medium">{fullName(detail.profile, detail.solicitante_nombre)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Área</div>
                  <div className="break-words font-medium">{detail.profile?.area ?? detail.solicitante_area ?? "Sin área"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="break-words font-medium">{detail.profile?.email ?? detail.solicitante_email ?? "Sin email"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de creación</div>
                  <div>{new Date(detail.fecha_creacion).toLocaleString("es-AR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de finalización</div>
                  <div>{detail.fecha_finalizacion ? new Date(detail.fecha_finalizacion).toLocaleString("es-AR") : "No corresponde"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Responsable asignado</div>
                  <div className="break-words font-medium">{detail.responsable ? `${detail.responsable.nombre ?? ""} ${detail.responsable.apellido ?? ""}`.trim() : "Sin asignar"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Colaborador</div>
                  <div className="break-words font-medium">{detail.colaborador ? `${detail.colaborador.nombre ?? ""} ${detail.colaborador.apellido ?? ""}`.trim() : "Ninguno"}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Descripción</div>
                <p className="break-words whitespace-pre-wrap rounded-lg border border-border bg-background p-3">{detail.descripcion}</p>
              </div>
              {detail.motivo_cancelacion && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Motivo de cancelación</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-3">{detail.motivo_cancelacion}</p>
                </div>
              )}
              {detail.estado === "pausado" && detail.motivo_pausa && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Motivo de pausa</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">{detail.motivo_pausa.descripcion}</p>
                </div>
              )}
              {detail.estado === "pausado" && detail.motivo_pausa_detalle && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Detalles de la pausa</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">{detail.motivo_pausa_detalle}</p>
                </div>
              )}
              {detail.estado === "finalizado" && detail.resolucion && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Resolución</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-green-500/30 bg-green-500/5 p-3">{detail.resolucion}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FINALIZATION DIALOG */}
      <Dialog open={!!pendingFinalization} onOpenChange={(open) => !open && setPendingFinalization(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">¿Qué se hizo para resolver?</label>
              <textarea
                placeholder="Describe la solución aplicada, cambios realizados, etc..."
                value={finalizationComment}
                onChange={(e) => setFinalizationComment(e.target.value)}
                className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium">¿Te ayudó otro técnico?</label>
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccioná un colaborador (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.nombre} {admin.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingFinalization(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void confirmFinalization()}>Finalizar solicitud</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PAUSE DIALOG */}
      <Dialog open={!!pendingPause} onOpenChange={(open) => !open && setPendingPause(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pausar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">¿Cuál es el motivo de la pausa?</p>
            <Select value={selectedPauseReason} onValueChange={setSelectedPauseReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPauseReason && motivos.find((m) => m.id === selectedPauseReason)?.descripcion === "Otro" && (
              <div>
                <label className="text-sm font-medium">Detalle de la pausa</label>
                <Input
                  placeholder="Describa por qué la solicitud está pausada..."
                  value={customPauseDetail}
                  onChange={(e) => setCustomPauseDetail(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingPause(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void confirmPause()}
                disabled={!selectedPauseReason || (motivos.find((m) => m.id === selectedPauseReason)?.descripcion === "Otro" && !customPauseDetail.trim())}
              >
                Pausar solicitud
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
