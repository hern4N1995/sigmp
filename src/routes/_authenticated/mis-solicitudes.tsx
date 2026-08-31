import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Eye, Trash2, X } from "lucide-react";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";
import { toast } from "sonner";

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
};

type Person = { nombre: string | null; apellido: string | null };

export const Route = createFileRoute("/_authenticated/mis-solicitudes")({
  head: () => ({
    meta: [
      { title: "Mis solicitudes - Soporte Sistemas" },
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

  const isCreatedToday = (date: string) => {
    const created = new Date(date);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: recentData }, { data: cancelledData }] = await Promise.all([
        supabase
          .from("solicitudes")
          .select("*")
          .order("fecha_creacion", { ascending: false })
          .limit(4),
        supabase
          .from("solicitudes")
          .select("*")
          .eq("estado", "cancelado")
          .order("fecha_creacion", { ascending: false }),
      ]);
      const list = Array.from(
        new Map(
          ([...(recentData ?? []), ...(cancelledData ?? [])] as Sol[]).map((item) => [item.id, item]),
        ).values(),
      ).sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
      const ids = Array.from(
        new Set(list.flatMap((item) => [item.asignado_a, item.colaborador_id]).filter((id): id is string => Boolean(id))),
      );
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, nombre, apellido").in("id", ids);
        const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
        list.forEach((item) => {
          item.responsable = item.asignado_a ? profileMap.get(item.asignado_a) : undefined;
          item.colaborador = item.colaborador_id ? profileMap.get(item.colaborador_id) : undefined;
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
    return () => {
      supabase.removeChannel(channel);
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
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis solicitudes</h1>
          <p className="text-sm text-muted-foreground">Seguimiento de todos tus pedidos al Área de Sistemas.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-32 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aún no registraste solicitudes.</p>
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
                <Button size="sm" variant="ghost" onClick={() => setDetail(s)} aria-label="Ver detalle">
                  <Eye className="mr-2 h-4 w-4" /> Ver detalle
                </Button>
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

      <Dialog open={!!pendingCancellation} onOpenChange={(open) => !open && setPendingCancellation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Indicá por qué querés cancelar esta solicitud.</p>
            <Textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              placeholder="Motivo de cancelación"
              aria-label="Motivo de cancelación"
              required
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingCancellation(null)}>Volver</Button>
              <Button disabled={!cancellationReason.trim() || cancelling} onClick={() => void confirmCancellation()}>
                {cancelling ? "Cancelando..." : "Confirmar cancelación"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeletion} onOpenChange={(open) => !open && setPendingDeletion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar solicitud cancelada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Eliminar esta solicitud cancelada? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDeletion(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={deleting} onClick={() => void confirmDeletion()}>
                {deleting ? "Eliminando..." : "Eliminar solicitud"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
