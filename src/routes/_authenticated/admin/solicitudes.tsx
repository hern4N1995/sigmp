import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";
import { ClipboardList, Search, CheckCircle2, Download, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Enums } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/solicitudes")({
  head: () => ({
    meta: [
      { title: "Solicitudes - SIG" },
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
  unidad_id: string | null;
  unidad_nombre_snapshot: string | null;
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
  revisada_en: string | null;
  profile?: {
    nombre: string | null;
    apellido: string | null;
    unidad: string | null;
    email: string | null;
  };
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

const DESKTOP_PAGE_SIZE = 6;
const MOBILE_PAGE_SIZE = 3;
type EstadoSolicitud = Enums<"estado_solicitud">;
const ESTADOS_SOLICITUD: EstadoSolicitud[] = [
  "en_espera",
  "en_proceso",
  "finalizado",
  "cancelado",
  "visto",
  "pausado",
];

function isEstadoSolicitud(value: string): value is EstadoSolicitud {
  return ESTADOS_SOLICITUD.some((estado) => estado === value);
}

function isOutOfRangeError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("status" in error && error.status === 416) || ("code" in error && error.code === "PGRST103"))
  );
}

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
  const isMobile = useIsMobile();
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const [viewMode, setViewMode] = useState<"current" | "historic">("current");
  const [currentPage, setCurrentPage] = useState(1);
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState<EstadoSolicitud | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const [itemsCurrentMonth, setItemsCurrentMonth] = useState<Row[]>([]);
  const [itemsHistoric, setItemsHistoric] = useState<Row[]>([]);
  const [totalCurrentMonth, setTotalCurrentMonth] = useState(0);
  const [totalHistoric, setTotalHistoric] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);

  const [admins, setAdmins] = useState<Array<{ id: string } & Person>>([]);
  const [motivos, setMotivos] = useState<MotivosPausa[]>([]);

  const [detail, setDetail] = useState<Row | null>(null);
  const [pendingFinalization, setPendingFinalization] = useState<Row | null>(null);
  const [pendingTicketCancellation, setPendingTicketCancellation] = useState<Row | null>(null);
  const [collaboratorId, setCollaboratorId] = useState("none");
  const [finalizationComment, setFinalizationComment] = useState("");
  const [pendingPause, setPendingPause] = useState<Row | null>(null);
  const [selectedPauseReason, setSelectedPauseReason] = useState<string>("");
  const [customPauseDetail, setCustomPauseDetail] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Realtime refreshes reload the page in place, without the loading spinner.
  const silentRefresh = useRef(false);

  useEffect(() => {
    const channel = supabase
      .channel("admin-solicitudes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, () => {
        silentRefresh.current = true;
        setRefreshTrigger((prev) => prev + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Opening a solicitud marks it as reviewed for every admin; the realtime
  // UPDATE then refreshes the list and the highlight goes away.
  useEffect(() => {
    if (!detail || detail.revisada_en) return;
    // Clear the highlight right away instead of waiting for the realtime refresh.
    const revisadaEn = new Date().toISOString();
    const markReviewed = (rows: Row[]) =>
      rows.map((row) => (row.id === detail.id ? { ...row, revisada_en: revisadaEn } : row));
    setItemsCurrentMonth(markReviewed);
    setItemsHistoric(markReviewed);
    supabase.rpc("marcar_solicitud_revisada", { _solicitud_id: detail.id }).then(({ error }) => {
      if (error) console.error("No se pudo marcar la solicitud como revisada.", error);
    });
  }, [detail]);

  // Rows get highlighted at different moments; anchoring every breathing animation
  // to the same start time keeps them pulsing in unison.
  useEffect(() => {
    if (typeof CSSAnimation === "undefined" || !document.getAnimations) return;
    document.getAnimations().forEach((animation) => {
      if (
        animation instanceof CSSAnimation &&
        animation.animationName === "solicitud-nueva-breathe"
      ) {
        animation.startTime = 0;
      }
    });
  });

  const highlightClass = (r: Row) =>
    r.estado !== "en_espera" || r.revisada_en
      ? undefined
      : r.urgencia === "urgente"
        ? "solicitud-nueva solicitud-nueva-urgente"
        : "solicitud-nueva";

  const loadCurrentMonth = async (page: number, pageSize: number) => {
    try {
      const { startISO, endISO } = getMonthRange();
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("solicitudes")
        .select("*", { count: "exact" })
        .gte("fecha_creacion", startISO)
        .lte("fecha_creacion", endISO)
        .order("fecha_creacion", { ascending: false });

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine && user?.id) {
        query = query.eq("asignado_a", user.id);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: (data as Row[]) ?? [],
        totalRecords: count ?? 0,
      };
    } catch (error) {
      if (isOutOfRangeError(error)) return null;
      toast.error("Error al cargar solicitudes");
      return { data: [], totalRecords: 0 };
    }
  };

  const loadHistoric = async (page: number, pageSize: number) => {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("solicitudes")
        .select("*", { count: "exact" })
        .order("fecha_creacion", { ascending: false });

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine && user?.id) {
        query = query.eq("asignado_a", user.id);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: (data as Row[]) ?? [],
        totalRecords: count ?? 0,
      };
    } catch (error) {
      if (isOutOfRangeError(error)) return null;
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

    if (ids.length || rows.some((row) => row.unidad_id)) {
      const { data: profs, error: profilesError } = ids.length
        ? await supabase
            .from("profiles")
            .select("id, nombre, apellido, unidad_id, es_jefe, email")
            .in("id", ids)
        : { data: [], error: null };
      if (profilesError) {
        toast.error(`No se pudieron cargar los perfiles: ${profilesError.message}`);
        return rows;
      }

      const unitIds = Array.from(
        new Set([
          ...rows.map((row) => row.unidad_id).filter((id): id is string => Boolean(id)),
          ...(profs ?? [])
            .map((profile) => profile.unidad_id)
            .filter((id): id is string => Boolean(id)),
        ]),
      );
      const { data: unitRows, error: unitsError } = unitIds.length
        ? await supabase.from("unidades_arbol").select("id, ruta, cargo_jefe").in("id", unitIds)
        : { data: [], error: null };
      if (unitsError) {
        toast.error(`No se pudieron cargar las unidades: ${unitsError.message}`);
        return rows;
      }

      const unitMap = new Map((unitRows ?? []).map((unidad) => [unidad.id, unidad]));
      const profileMap = new Map((profs ?? []).map((profile) => [profile.id, profile]));
      rows.forEach((row) => {
        const profile = row.usuario_id ? profileMap.get(row.usuario_id) : undefined;
        const ticketUnit = row.unidad_id ? unitMap.get(row.unidad_id) : undefined;
        const profileUnit = profile?.unidad_id ? unitMap.get(profile.unidad_id) : undefined;
        const unitDisplay = profile?.es_jefe
          ? (ticketUnit?.cargo_jefe ?? profileUnit?.cargo_jefe ?? row.unidad_nombre_snapshot)
          : (row.unidad_nombre_snapshot ?? ticketUnit?.ruta ?? profileUnit?.ruta ?? null);
        row.profile = profile
          ? {
              nombre: profile.nombre,
              apellido: profile.apellido,
              email: profile.email,
              unidad: unitDisplay,
            }
          : {
              nombre: row.solicitante_nombre,
              apellido: null,
              email: row.solicitante_email,
              unidad: row.unidad_nombre_snapshot ?? ticketUnit?.ruta ?? null,
            };
        row.responsable = row.asignado_a ? profileMap.get(row.asignado_a) : undefined;
        row.colaborador = row.colaborador_id ? profileMap.get(row.colaborador_id) : undefined;
      });
    }

    const pausedRows = rows.filter((r) => r.estado === "pausado" && r.motivo_pausa_id);
    if (pausedRows.length) {
      const motivoIds = Array.from(
        new Set(pausedRows.map((r) => r.motivo_pausa_id).filter((id): id is string => Boolean(id))),
      );
      if (motivoIds.length) {
        const { data: motivosDataDetail } = await supabase
          .from("motivos_pausa")
          .select("*")
          .in("id", motivoIds);
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

      if (motivosData.error) {
        toast.error(`No se pudieron cargar los motivos de pausa: ${motivosData.error.message}`);
      } else {
        setMotivos(motivosData.data ?? []);
      }

      if (adminRoles.error) {
        toast.error(`No se pudieron cargar los administradores: ${adminRoles.error.message}`);
        setLoading(false);
        return;
      }
      const adminIds = adminRoles.data.map((role) => role.user_id).filter((id) => id !== user?.id);
      if (adminIds.length) {
        const { data: adminProfiles, error: adminProfilesError } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, email")
          .in("id", adminIds);
        if (adminProfilesError) {
          toast.error(
            `No se pudieron cargar los perfiles administradores: ${adminProfilesError.message}`,
          );
        } else {
          setAdmins(adminProfiles ?? []);
        }
      } else {
        setAdmins([]);
      }

      setLoading(false);
    };

    loadData();
  }, [user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    let cancelled = false;
    const loadPage = async () => {
      const silent = silentRefresh.current;
      silentRefresh.current = false;
      if (!silent) setLoadingPage(true);
      try {
        if (viewMode === "current") {
          const result = await loadCurrentMonth(currentPage, pageSize);
          if (!result) {
            if (!cancelled) setCurrentPage(1);
            return;
          }
          const enriched = await enrichRows(result.data);
          if (cancelled) return;
          setItemsCurrentMonth(enriched);
          setTotalCurrentMonth(result.totalRecords);
        } else {
          const result = await loadHistoric(currentPage, pageSize);
          if (!result) {
            if (!cancelled) setCurrentPage(1);
            return;
          }
          const enriched = await enrichRows(result.data);
          if (cancelled) return;
          setItemsHistoric(enriched);
          setTotalHistoric(result.totalRecords);
        }
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    };

    void loadPage();
    return () => {
      cancelled = true;
    };
  }, [viewMode, currentPage, filterEstado, onlyMine, user?.id, refreshTrigger, pageSize]);

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
        (r.profile?.unidad ?? "").toLowerCase().includes(s),
    );
  }, [itemsCurrentMonth, itemsHistoric, q, viewMode]);

  const totalRecords = viewMode === "current" ? totalCurrentMonth : totalHistoric;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const paginationItems: Array<number | "start-ellipsis" | "end-ellipsis"> =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : currentPage <= 4
        ? [1, 2, 3, 4, 5, "end-ellipsis", totalPages]
        : currentPage >= totalPages - 3
          ? [
              1,
              "start-ellipsis",
              totalPages - 4,
              totalPages - 3,
              totalPages - 2,
              totalPages - 1,
              totalPages,
            ]
          : [
              1,
              "start-ellipsis",
              currentPage - 1,
              currentPage,
              currentPage + 1,
              "end-ellipsis",
              totalPages,
            ];

  const changeEstado = async (
    id: string,
    estado: Row["estado"],
    selectedCollaboratorId: string | null = null,
    resolucion: string | null = null,
  ): Promise<boolean> => {
    setProcessingTicketId(id);
    try {
      const { error } = await supabase
        .from("solicitudes")
        .update({
          estado,
          ...(estado === "finalizado"
            ? { colaborador_id: selectedCollaboratorId, resolucion }
            : {}),
        })
        .eq("id", id);

      if (error) {
        toast.error(error.message);
        return false;
      } else {
        toast.success("Estado actualizado");
        setCurrentPage(1);
        setRefreshTrigger((prev) => prev + 1);
        return true;
      }
    } catch (error) {
      console.error("No se pudo actualizar el estado de la solicitud.", error);
      toast.error("No se pudo actualizar el estado. Intentá nuevamente.");
      return false;
    } finally {
      setProcessingTicketId(null);
    }
  };

  const requestEstadoChange = (row: Row, estado: Row["estado"]) => {
    if (estado === "cancelado") {
      setPendingTicketCancellation(row);
      return;
    }
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

    setPausing(true);
    try {
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
    } catch (error) {
      console.error("No se pudo pausar la solicitud.", error);
      toast.error("No se pudo pausar la solicitud. Intentá nuevamente.");
    } finally {
      setPausing(false);
    }
  };

  const confirmFinalization = async () => {
    if (!pendingFinalization) return;
    const updated = await changeEstado(
      pendingFinalization.id,
      "finalizado",
      collaboratorId === "none" ? null : collaboratorId,
      finalizationComment || null,
    );
    if (updated) setPendingFinalization(null);
  };

  const confirmTicketCancellation = async () => {
    if (!pendingTicketCancellation) return;
    const updated = await changeEstado(pendingTicketCancellation.id, "cancelado");
    if (updated) setPendingTicketCancellation(null);
  };

  const exportToCSV = async () => {
    try {
      setExporting(true);
      let query = supabase
        .from("solicitudes")
        .select("*")
        .order("fecha_creacion", { ascending: false });

      if (viewMode === "current") {
        const { startISO, endISO } = getMonthRange();
        query = query.gte("fecha_creacion", startISO).lte("fecha_creacion", endISO);
      }

      if (filterEstado !== "all") {
        query = query.eq("estado", filterEstado);
      }

      if (onlyMine && user?.id) {
        query = query.eq("asignado_a", user.id);
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
      const headers = [
        "Fecha",
        "Empleado",
        "Unidad",
        "Motivo",
        "Urgencia",
        "Estado",
        "Responsable",
        "Descripción",
      ];
      const rows = enriched.map((r) => [
        new Date(r.fecha_creacion).toLocaleString("es-AR"),
        `${r.profile?.nombre ?? r.solicitante_nombre ?? ""} ${r.profile?.apellido ?? ""}`.trim(),
        r.profile?.unidad ?? r.unidad_nombre_snapshot ?? "Sin unidad",
        r.motivo,
        r.urgencia,
        r.estado,
        r.responsable?.nombre ?? "-",
        r.descripcion,
      ]);

      const csv = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

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
      console.error("No se pudieron exportar las solicitudes.", error);
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
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

  const fullName = (
    profile?: Pick<Person, "nombre" | "apellido">,
    solicitanteName?: string | null,
  ) => {
    if (profile?.nombre) return `${profile.nombre} ${profile.apellido ?? ""}`.trim();
    return solicitanteName ?? "Usuario eliminado";
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-2" aria-label="Cargando solicitudes">
          <div className="hidden space-y-2 md:block">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
          <div className="space-y-2 md:hidden">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Solicitudes"
        description="Gestioná todos los pedidos recibidos."
        icon={ClipboardList}
      />

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
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="ml-auto gap-2"
              disabled={exporting}
            >
              {exporting ? <Spinner size="sm" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exportando…" : "Exportar CSV"}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por motivo, empleado o unidad..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterEstado}
            onValueChange={(value) => {
              setCurrentPage(1);
              if (value === "all" || isEstadoSolicitud(value)) setFilterEstado(value);
            }}
          >
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
          <Button
            type="button"
            variant={onlyMine ? "default" : "outline"}
            onClick={() => {
              setCurrentPage(1);
              setOnlyMine((value) => !value);
            }}
          >
            Mis solicitudes
          </Button>
        </div>

        {/* Loading */}
        {loadingPage ? (
          <div className="space-y-2" aria-label="Cargando solicitudes">
            <div className="hidden space-y-2 md:block">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
            <div className="space-y-2 md:hidden">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          </div>
        ) : displayData.length === 0 ? (
          <EmptyState
            title={
              q || filterEstado !== "all" || onlyMine
                ? "No hay resultados para estos filtros"
                : "Todavía no hay solicitudes"
            }
            description={
              q || filterEstado !== "all" || onlyMine
                ? "Probá con otros criterios o limpiá los filtros para ver todas las solicitudes."
                : "Las solicitudes recibidas aparecerán en esta lista."
            }
            icon={ClipboardList}
            action={
              q || filterEstado !== "all" || onlyMine ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setFilterEstado("all");
                    setOnlyMine(false);
                    setCurrentPage(1);
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Empleado</th>
                    <th className="px-3 py-2 font-medium">Unidad</th>
                    <th className="px-3 py-2 font-medium">Motivo</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayData.map((r) => (
                    <tr
                      key={r.id}
                      className={cn("cursor-pointer hover:bg-muted/30", highlightClass(r))}
                      onClick={() => setDetail(r)}
                    >
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatDate(r.fecha_creacion)}
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {fullName(r.profile, r.solicitante_nombre)}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {r.profile?.unidad ?? r.unidad_nombre_snapshot ?? "Sin unidad"}
                      </td>
                      <td className="max-w-xs truncate px-3 py-3 text-sm">{r.motivo}</td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={r.estado}
                          onValueChange={(v) => requestEstadoChange(r, v as Row["estado"])}
                          disabled={processingTicketId === r.id}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            {processingTicketId === r.id && <Spinner size="sm" />}
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
                                {r.estado === "en_proceso" && (
                                  <SelectItem value="pausado">Pausar</SelectItem>
                                )}
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
                              disabled={processingTicketId === r.id}
                              aria-label={
                                r.estado === "cancelado"
                                  ? "Marcar solicitud como vista"
                                  : "Finalizar solicitud"
                              }
                              onClick={() =>
                                requestEstadoChange(
                                  r,
                                  r.estado === "cancelado" ? "visto" : "finalizado",
                                )
                              }
                            >
                              {processingTicketId === r.id ? (
                                <Spinner size="sm" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              )}
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
                <Card key={r.id} className={cn("p-4", highlightClass(r))}>
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">
                        {formatDate(r.fecha_creacion)}
                      </div>
                      <div className="font-medium">{fullName(r.profile, r.solicitante_nombre)}</div>
                    </div>
                    <UrgenciaBadge value={r.urgencia} />
                  </div>
                  <div className="mb-3 space-y-1 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Unidad: </span>
                      {r.profile?.unidad ?? r.unidad_nombre_snapshot ?? "Sin unidad"}
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setDetail(r)}
                    >
                      Ver
                    </Button>
                    {r.estado !== "finalizado" && r.estado !== "visto" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          requestEstadoChange(r, r.estado === "cancelado" ? "visto" : "finalizado")
                        }
                      >
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 0 && (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} ({totalRecords} registros; {pageSize} por
                  página)
                  {viewMode === "current" && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => {
                          setViewMode("historic");
                          setCurrentPage(1);
                        }}
                      >
                        Ver meses anteriores
                      </button>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  >
                    Anterior
                  </Button>
                  {paginationItems.map((item, index) =>
                    typeof item === "number" ? (
                      <Button
                        key={item}
                        size="sm"
                        variant={item === currentPage ? "default" : "outline"}
                        aria-current={item === currentPage ? "page" : undefined}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </Button>
                    ) : (
                      <span
                        key={`${item}-${index}`}
                        aria-hidden="true"
                        className="flex h-9 w-9 items-center justify-center text-muted-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    ),
                  )}
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
                  <div className="break-words font-medium">
                    {fullName(detail.profile, detail.solicitante_nombre)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Unidad</div>
                  <div className="break-words font-medium">
                    {detail.profile?.unidad ?? detail.unidad_nombre_snapshot ?? "Sin unidad"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="break-words font-medium">
                    {detail.profile?.email ?? detail.solicitante_email ?? "Sin email"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de creación</div>
                  <div>{new Date(detail.fecha_creacion).toLocaleString("es-AR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de finalización</div>
                  <div>
                    {detail.fecha_finalizacion
                      ? new Date(detail.fecha_finalizacion).toLocaleString("es-AR")
                      : "No corresponde"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Responsable asignado</div>
                  <div className="break-words font-medium">
                    {detail.responsable
                      ? `${detail.responsable.nombre ?? ""} ${detail.responsable.apellido ?? ""}`.trim()
                      : "Sin asignar"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Colaborador</div>
                  <div className="break-words font-medium">
                    {detail.colaborador
                      ? `${detail.colaborador.nombre ?? ""} ${detail.colaborador.apellido ?? ""}`.trim()
                      : "Ninguno"}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Descripción</div>
                <p className="break-words whitespace-pre-wrap rounded-lg border border-border bg-background p-3">
                  {detail.descripcion}
                </p>
              </div>
              {detail.motivo_cancelacion && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Motivo de cancelación</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    {detail.motivo_cancelacion}
                  </p>
                </div>
              )}
              {detail.estado === "pausado" && detail.motivo_pausa && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Motivo de pausa</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    {detail.motivo_pausa.descripcion}
                  </p>
                </div>
              )}
              {detail.estado === "pausado" && detail.motivo_pausa_detalle && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Detalles de la pausa</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    {detail.motivo_pausa_detalle}
                  </p>
                </div>
              )}
              {detail.estado === "finalizado" && detail.resolucion && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Resolución</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    {detail.resolucion}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FINALIZATION DIALOG */}
      <Dialog
        open={!!pendingFinalization}
        onOpenChange={(open) => !open && setPendingFinalization(null)}
      >
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
              <Button
                onClick={() => void confirmFinalization()}
                disabled={processingTicketId === pendingFinalization?.id}
              >
                {processingTicketId === pendingFinalization?.id && <Spinner size="sm" />}
                {processingTicketId === pendingFinalization?.id
                  ? "Finalizando…"
                  : "Finalizar solicitud"}
              </Button>
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
            {selectedPauseReason &&
              motivos.find((m) => m.id === selectedPauseReason)?.descripcion === "Otro" && (
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
                disabled={
                  pausing ||
                  !selectedPauseReason ||
                  (motivos.find((m) => m.id === selectedPauseReason)?.descripcion === "Otro" &&
                    !customPauseDetail.trim())
                }
              >
                {pausing && <Spinner size="sm" />}
                {pausing ? "Pausando…" : "Pausar solicitud"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingTicketCancellation}
        onOpenChange={(open) =>
          !open && processingTicketId === null && setPendingTicketCancellation(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitud</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmás la cancelación de “{pendingTicketCancellation?.motivo}”? La solicitud
              quedará marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingTicketId !== null}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={processingTicketId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmTicketCancellation();
              }}
            >
              {processingTicketId === pendingTicketCancellation?.id && <Spinner size="sm" />}
              {processingTicketId === pendingTicketCancellation?.id
                ? "Cancelando…"
                : "Cancelar solicitud"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
