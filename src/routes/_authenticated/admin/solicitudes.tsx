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
import { ClipboardList, Search, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/solicitudes")({
  head: () => ({
    meta: [
      { title: "Gestión de solicitudes — Administración" },
      { name: "description", content: "Listado completo de solicitudes de soporte." },
    ],
  }),
  component: AdminSolicitudes,
});

type Row = {
  id: string;
  usuario_id: string;
  motivo: string;
  descripcion: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
  profile?: { nombre: string | null; apellido: string | null; area: string | null; email: string | null };
};

function AdminSolicitudes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [detail, setDetail] = useState<Row | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("solicitudes")
      .select("*")
      .order("fecha_creacion", { ascending: false });
    const list = (data as Row[]) ?? [];
    // fetch profiles
    const ids = Array.from(new Set(list.map((r) => r.usuario_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, area, email")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      list.forEach((r) => (r.profile = map.get(r.usuario_id) as any));
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-solicitudes")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterEstado !== "all" && r.estado !== filterEstado) return false;
      if (q) {
        const s = q.toLowerCase();
        return (
          r.motivo.toLowerCase().includes(s) ||
          (r.profile?.nombre ?? "").toLowerCase().includes(s) ||
          (r.profile?.apellido ?? "").toLowerCase().includes(s) ||
          (r.profile?.area ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [rows, q, filterEstado]);

  const changeEstado = async (id: string, estado: Row["estado"]) => {
    const { error } = await supabase.from("solicitudes").update({ estado }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Estado actualizado");
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes</h1>
          <p className="text-sm text-muted-foreground">Gestioná todos los pedidos recibidos.</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por motivo, empleado o área..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="en_espera">En espera</SelectItem>
              <SelectItem value="en_proceso">En proceso</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Sin resultados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Empleado</th>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Urgencia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3 text-muted-foreground">
                      {new Date(r.fecha_creacion).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {r.profile?.nombre} {r.profile?.apellido}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{r.profile?.area}</td>
                    <td className="max-w-xs truncate px-3 py-3">{r.motivo}</td>
                    <td className="px-3 py-3"><UrgenciaBadge value={r.urgencia} /></td>
                    <td className="px-3 py-3">
                      <Select value={r.estado} onValueChange={(v) => changeEstado(r.id, v as Row["estado"])}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en_espera">En espera</SelectItem>
                          <SelectItem value="en_proceso">En proceso</SelectItem>
                          <SelectItem value="finalizado">Finalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {r.estado !== "finalizado" && (
                          <Button size="sm" variant="ghost" onClick={() => changeEstado(r.id, "finalizado")}>
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
        )}
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.motivo}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <UrgenciaBadge value={detail.urgencia} />
                <EstadoBadge value={detail.estado} />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
                <div>
                  <div className="text-xs text-muted-foreground">Empleado</div>
                  <div className="font-medium">{detail.profile?.nombre} {detail.profile?.apellido}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Área</div>
                  <div className="font-medium">{detail.profile?.area}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="truncate font-medium">{detail.profile?.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Creado</div>
                  <div className="font-medium">
                    {new Date(detail.fecha_creacion).toLocaleString("es-AR")}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Descripción</div>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3">
                  {detail.descripcion}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
