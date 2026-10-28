import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Eye, Star, Trash2, X } from "lucide-react";
import {
  CALIFICACIONES_EVENT,
  CalificacionDialog,
  Estrellas,
  useSolicitudesPorCalificar,
  type SolicitudPorCalificar,
} from "@/components/calificacion";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/empty-state";

type Sol = {
  id: string;
  motivo: string;
  descripcion: string;
  asignado_a: string | null;
  colaborador_id: string | null;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
  motivo_cancelacion: string | null;
  responsable?: Person;
  colaborador?: Person;
  calificacion?: Calificacion;
};

type Person = { nombre: string | null; apellido: string | null };
type Calificacion = { puntaje: number | null; comentario: string | null; omitida: boolean };

export const Route = createFileRoute("/_authenticated/mis-solicitudes")({
  head: () => ({
    meta: [
      { title: "Mis solicitudes - SIG" },
      { name: "description", content: "Historial y estado de tus solicitudes." },
    ],
  }),
  component: MisSolicitudes,
});

function MisSolicitudes() {
  const [items, setItems] = useState<Sol[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCancellation, setPendingCancellation] = useState<Sol | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [detail, setDetail] = useState<Sol | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<Sol | null>(null);
  const [deleting, setDeleting] = useState(false);
  const porCalificar = useSolicitudesPorCalificar();
  const [calificando, setCalificando] = useState<SolicitudPorCalificar | null>(null);

  const isCreatedToday = (date: string) => {
    const created = new Date(date);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  };

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      // Filter explicitly: RLS lets administrators read every solicitud.
      const [
        { data: recentData, error: recentError },
        { data: cancelledData, error: cancelledError },
      ] = await Promise.all([
        supabase
          .from("solicitudes")
          .select("*")
          .eq("usuario_id", auth.user.id)
          .order("fecha_creacion", { ascending: false })
          .limit(4),
        supabase
          .from("solicitudes")
          .select("*")
          .eq("usuario_id", auth.user.id)
          .eq("estado", "cancelado")
          .order("fecha_creacion", { ascending: false }),
      ]);
      if (recentError || cancelledError) {
        const error = recentError ?? cancelledError;
        console.error("No se pudieron cargar las solicitudes del usuario.", error);
        toast.error("No se pudieron cargar tus solicitudes. Intentá nuevamente.");
        setLoading(false);
        return;
      }
      const list = Array.from(
        new Map(
          ([...(recentData ?? []), ...(cancelledData ?? [])] as Sol[]).map((item) => [item.id, item]),
        ).values(),
      ).sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
      const ids = Array.from(
        new Set(list.flatMap((item) => [item.asignado_a, item.colaborador_id]).filter((id): id is string => Boolean(id))),
      );
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nombre, apellido")
          .in("id", ids);
        if (profilesError) {
          console.error("No se pudieron cargar los perfiles relacionados.", profilesError);
          toast.error("No se pudieron cargar los datos de las solicitudes.");
          setLoading(false);
          return;
        }
        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        list.forEach((item) => {
          item.responsable = item.asignado_a ? profileMap.get(item.asignado_a) : undefined;
          item.colaborador = item.colaborador_id ? profileMap.get(item.colaborador_id) : undefined;
        });
      }
      const finalizadas = list.filter((item) => item.estado === "finalizado").map((item) => item.id);
      if (finalizadas.length) {
        const { data: calificaciones, error: calificacionesError } = await supabase
          .from("calificaciones")
          .select("solicitud_id, puntaje, comentario, omitida")
          .in("solicitud_id", finalizadas);
        if (calificacionesError) {
          console.error("No se pudieron cargar las calificaciones.", calificacionesError);
        }
        const calificacionMap = new Map((calificaciones ?? []).map((c) => [c.solicitud_id, c]));
        list.forEach((item) => {
          item.calificacion = calificacionMap.get(item.id);
        });
      }
      setItems(list);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("mis-solicitudes")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, load)
      .subscribe();
    window.addEventListener(CALIFICACIONES_EVENT, load);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CALIFICACIONES_EVENT, load);
    };
  }, []);

  const confirmCancellation = async () => {
    const reason = cancellationReason.trim();
    if (!pendingCancellation || !reason) {
      toast.error("Indicá el motivo de cancelación");
      return;
    }
    setCancelling(true);
    const { error } = await supabase
      .from("solicitudes")
      .update({ estado: "cancelado", motivo_cancelacion: reason })
      .eq("id", pendingCancellation.id);
    setCancelling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Solicitud cancelada");
    setPendingCancellation(null);
    setCancellationReason("");
    setItems((current) => current.map((item) => item.id === pendingCancellation.id ? { ...item, estado: "cancelado", motivo_cancelacion: reason } : item));
  };

  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    setDeleting(true);
    const { error } = await supabase.from("solicitudes").delete().eq("id", pendingDeletion.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Solicitud eliminada");
    setItems((current) => current.filter((item) => item.id !== pendingDeletion.id));
    setPendingDeletion(null);
    if (detail?.id === pendingDeletion.id) setDetail(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Mis solicitudes"
        description="Seguimiento de todos tus pedidos al Área de Sistemas."
        icon={ClipboardList}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Cargando solicitudes">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="Todavía no tenés solicitudes"
            description="Cuando necesites ayuda, creá una solicitud para contactar al Área de Sistemas."
            icon={ClipboardList}
            action={
              <Button asChild>
                <Link to="/nueva-solicitud">Crear solicitud</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((s) => (
            <Card key={s.id} className="p-5 transition-colors hover:border-primary/50">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words text-base font-semibold leading-tight">{s.motivo}</h3>
                <UrgenciaBadge value={s.urgencia} />
              </div>
              <p className="mb-3 line-clamp-2 min-w-0 break-words whitespace-pre-wrap text-sm text-muted-foreground">{s.descripcion}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(s.fecha_creacion).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <EstadoBadge value={s.estado} />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {s.calificacion?.puntaje && (
                  <Estrellas puntaje={s.calificacion.puntaje} className="mr-auto self-center" />
                )}
                <Button size="sm" variant="ghost" onClick={() => setDetail(s)} aria-label="Ver detalle">
                  <Eye className="mr-2 h-4 w-4" /> Ver detalle
                </Button>
                {porCalificar.some((p) => p.id === s.id) && (
                  <Button
                    size="sm"
                    onClick={() => setCalificando(porCalificar.find((p) => p.id === s.id) ?? null)}
                  >
                    <Star className="mr-2 h-4 w-4" /> Calificar
                  </Button>
                )}
                {isCreatedToday(s.fecha_creacion) && (s.estado === "en_espera" || s.estado === "en_proceso") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPendingCancellation(s);
                      setCancellationReason("");
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancelar
                  </Button>
                )}
                {s.estado === "cancelado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingDeletion(s)}
                    aria-label="Eliminar solicitud cancelada"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </Button>
                )}
              </div>
              {s.estado === "cancelado" && s.motivo_cancelacion && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="text-xs font-medium text-muted-foreground">Motivo de cancelación</div>
                  <p className="mt-1 whitespace-pre-wrap">{s.motivo_cancelacion}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
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
                  <div className="text-xs text-muted-foreground">Fecha de creación</div>
                  <div>{new Date(detail.fecha_creacion).toLocaleString("es-AR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Fecha de finalización</div>
                  <div>{detail.fecha_finalizacion ? new Date(detail.fecha_finalizacion).toLocaleString("es-AR") : "No corresponde"}</div>
                </div>
                {detail.estado === "finalizado" && (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Responsable</div>
                      <div>{detail.responsable ? `${detail.responsable.nombre ?? ""} ${detail.responsable.apellido ?? ""}`.trim() : "Sin asignar"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Colaborador</div>
                      <div>{detail.colaborador ? `${detail.colaborador.nombre ?? ""} ${detail.colaborador.apellido ?? ""}`.trim() : "Ninguno"}</div>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Descripción</div>
                <p className="break-words whitespace-pre-wrap rounded-lg border border-border bg-background p-3">{detail.descripcion}</p>
              </div>
              {detail.calificacion?.puntaje && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Tu calificación</div>
                  <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                    <Estrellas puntaje={detail.calificacion.puntaje} />
                    {detail.calificacion.comentario && (
                      <p className="break-words whitespace-pre-wrap">{detail.calificacion.comentario}</p>
                    )}
                  </div>
                </div>
              )}
              {detail.motivo_cancelacion && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Motivo de cancelación</div>
                  <p className="break-words whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-3">{detail.motivo_cancelacion}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingCancellation}
        onOpenChange={(open) => !open && !cancelling && setPendingCancellation(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitud</AlertDialogTitle>
            <AlertDialogDescription>
              Indicá el motivo y confirmá si querés cancelar esta solicitud.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Motivo de cancelación"
              aria-label="Motivo de cancelación"
              required
              disabled={cancelling}
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Volver</AlertDialogCancel>
              <AlertDialogAction
                disabled={!cancellationReason.trim() || cancelling}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmCancellation();
                }}
              >
                {cancelling && <Spinner size="sm" />}
                {cancelling ? "Cancelando…" : "Confirmar cancelación"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDeletion}
        onOpenChange={(open) => !open && !deleting && setPendingDeletion(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar solicitud cancelada</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar esta solicitud cancelada? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeletion();
              }}
            >
                {deleting && <Spinner size="sm" />}
                {deleting ? "Eliminando…" : "Eliminar solicitud"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CalificacionDialog solicitud={calificando} onClose={() => setCalificando(null)} />
    </AppShell>
  );
}
