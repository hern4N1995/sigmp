import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, AlertTriangle, Clock, CircleCheck, CircleDot } from "lucide-react";
import { EstadoBadge, UrgenciaBadge } from "@/components/badges";

type Sol = {
  id: string;
  motivo: string;
  descripcion: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
};

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

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("solicitudes")
        .select("*")
        .order("fecha_creacion", { ascending: false });
      setItems((data as Sol[]) ?? []);
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
                <h3 className="text-base font-semibold leading-tight">{s.motivo}</h3>
                <UrgenciaBadge value={s.urgencia} />
              </div>
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{s.descripcion}</p>
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
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
