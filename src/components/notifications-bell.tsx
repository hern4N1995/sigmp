import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Bell, ChevronRight, Inbox, Star } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SolicitudPorCalificar } from "@/components/calificacion";

export type PendingSolicitud = {
  id: string;
  motivo: string;
  urgencia: "urgente" | "normal";
  fecha_creacion: string;
  solicitante_nombre: string | null;
  unidad_nombre_snapshot: string | null;
  revisada_en: string | null;
};

const relativeTime = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function timeAgo(date: string) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function NotificationsBell({
  isAdmin,
  pending,
  items,
  porCalificar,
  onCalificar,
  onOpen,
  className,
}: {
  isAdmin: boolean;
  pending: number;
  items: PendingSolicitud[];
  porCalificar: SolicitudPorCalificar[];
  onCalificar: (solicitud: SolicitudPorCalificar) => void;
  /** Called when the overlay opens, e.g. to silence the alarm. */
  onOpen: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const urgentes = items.filter((item) => item.urgencia === "urgente").length;
  const sinRevisar = items.filter((item) => !item.revisada_en).length;
  const total = (isAdmin ? pending : 0) + porCalificar.length;

  const goToSolicitudes = () => {
    setOpen(false);
    navigate({ to: "/admin/solicitudes" });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `${total} notificaciones` : "Sin notificaciones"}
          className={cn(
            "app-shell-bell-button relative flex size-10 items-center justify-center rounded-md hover:bg-accent",
            className,
          )}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {total > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="max-h-[70vh] overflow-y-auto">
          {porCalificar.length > 0 && (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">Calificá la atención</div>
                <div className="text-xs text-muted-foreground">
                  {porCalificar.length === 1
                    ? "1 solicitud finalizada para calificar"
                    : `${porCalificar.length} solicitudes finalizadas para calificar`}
                </div>
              </div>
              <ul className="divide-y divide-border border-b border-border">
                {porCalificar.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onCalificar(item);
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/50"
                    >
                      <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.motivo}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.responsable_nombre
                            ? `Atendida por ${item.responsable_nombre}`
                            : "Finalizada"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(item.fecha_finalizacion)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {isAdmin && (
            <>
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">Solicitudes en espera</div>
                <div className="text-xs text-muted-foreground">
                  {pending === 0
                    ? "No hay solicitudes pendientes."
                    : [
                        `${pending} en espera`,
                        urgentes > 0 && `${urgentes} urgente${urgentes === 1 ? "" : "s"}`,
                        sinRevisar > 0 && `${sinRevisar} sin revisar`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </div>
              </div>

              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                  <Inbox className="h-6 w-6" />
                  Todo al día.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={goToSolicitudes}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/50"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            item.revisada_en ? "bg-transparent" : "bg-primary",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {item.urgencia === "urgente" && (
                              <AlertTriangle
                                aria-label="Urgente"
                                className="h-3.5 w-3.5 shrink-0 text-destructive"
                              />
                            )}
                            <span className="truncate text-sm font-medium">{item.motivo}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.solicitante_nombre ?? "Sin nombre"}
                            {item.unidad_nombre_snapshot ? ` · ${item.unidad_nombre_snapshot}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(item.fecha_creacion)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!isAdmin && porCalificar.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-6 w-6" />
              No tenés notificaciones.
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={goToSolicitudes}
            >
              Ver todas las solicitudes
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
