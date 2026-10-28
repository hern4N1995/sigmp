import { useCallback, useEffect, useId, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

export type SolicitudPorCalificar = {
  id: string;
  motivo: string;
  fecha_finalizacion: string;
  responsable_nombre: string | null;
};

export const CALIFICACIONES_EVENT = "calificaciones-actualizadas";
const PUNTAJE_LABELS = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

/** Solicitudes finalizadas del usuario que todavía puede calificar (reglas en la base). */
export function useSolicitudesPorCalificar() {
  const { user } = useAuth();
  const channelId = useId();
  const [items, setItems] = useState<SolicitudPorCalificar[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("solicitudes_por_calificar");
    if (error) {
      console.error("No se pudieron cargar las solicitudes por calificar.", error);
      return;
    }
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const channel = supabase
      .channel(`por-calificar-${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, () => {
        void load();
      })
      .subscribe();
    const onChange = () => void load();
    window.addEventListener(CALIFICACIONES_EVENT, onChange);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CALIFICACIONES_EVENT, onChange);
    };
  }, [user, load, channelId]);

  return items;
}

export function Estrellas({ puntaje, className }: { puntaje: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${puntaje} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            "h-3.5 w-3.5",
            n <= puntaje ? "fill-primary text-primary" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function CalificacionDialog({
  solicitud,
  onClose,
}: {
  solicitud: SolicitudPorCalificar | null;
  onClose: () => void;
}) {
  const [puntaje, setPuntaje] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [confirmando, setConfirmando] = useState<"enviar" | "omitir" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPuntaje(0);
    setHover(0);
    setComentario("");
    setConfirmando(null);
  }, [solicitud?.id]);

  const guardar = async () => {
    if (!solicitud || !confirmando) return;
    const omitir = confirmando === "omitir";
    setSaving(true);
    const { error } = await supabase.rpc("calificar_solicitud", {
      _solicitud_id: solicitud.id,
      _puntaje: omitir ? null : puntaje,
      _comentario: omitir ? null : comentario.trim() || null,
      _omitir: omitir,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(omitir ? "Calificación omitida" : "¡Gracias por tu calificación!");
    window.dispatchEvent(new Event(CALIFICACIONES_EVENT));
    setConfirmando(null);
    onClose();
  };

  const visible = hover || puntaje;

  return (
    <>
      <Dialog open={!!solicitud && !confirmando} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calificar atención</DialogTitle>
            <DialogDescription className="break-words">
              {solicitud?.motivo}
              {solicitud?.responsable_nombre && ` · Atendida por ${solicitud.responsable_nombre}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex gap-1"
                role="radiogroup"
                aria-label="Puntaje"
                onMouseLeave={() => setHover(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={puntaje === n}
                    aria-label={`${n} - ${PUNTAJE_LABELS[n]}`}
                    onClick={() => setPuntaje(n)}
                    onMouseEnter={() => setHover(n)}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-8 w-8",
                        n <= visible ? "fill-primary text-primary" : "text-muted-foreground/50",
                      )}
                    />
                  </button>
                ))}
              </div>
              <div className="h-5 text-sm font-medium text-muted-foreground">
                {PUNTAJE_LABELS[visible]}
              </div>
            </div>

            <Textarea
              value={comentario}
              onChange={(event) => setComentario(event.target.value)}
              placeholder="Comentario (opcional)"
              aria-label="Comentario"
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setConfirmando("omitir")}>
              Omitir
            </Button>
            <Button disabled={puntaje === 0} onClick={() => setConfirmando("enviar")}>
              Enviar calificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!solicitud && !!confirmando}
        onOpenChange={(open) => !open && !saving && setConfirmando(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando === "omitir" ? "¿Omitir calificación?" : "Confirmar calificación"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {confirmando === "enviar" && (
                  <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-foreground">
                    <div className="flex items-center gap-2">
                      <Estrellas puntaje={puntaje} />
                      <span className="text-sm font-medium">{PUNTAJE_LABELS[puntaje]}</span>
                    </div>
                    {comentario.trim() && (
                      <p className="break-words whitespace-pre-wrap text-sm">{comentario.trim()}</p>
                    )}
                  </div>
                )}
                <p>
                  {confirmando === "omitir"
                    ? "No se te volverá a pedir que califiques esta solicitud."
                    : "Una vez enviada, la calificación no se puede modificar."}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void guardar();
              }}
            >
              {saving && <Spinner size="sm" />}
              {confirmando === "omitir" ? "Omitir" : "Confirmar y enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
