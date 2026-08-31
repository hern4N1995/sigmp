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
  usuario_id: string;
  motivo: string;
  descripcion: string;
  urgencia: "urgente" | "normal";
  estado: "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto";
  fecha_creacion: string;
  fecha_finalizacion: string | null;
  motivo_cancelacion: string | null;
  profile?: { nombre: string | null; apellido: string | null; area: string | null; email: string | null };
  responsable?: Person;
  colaborador?: Person;
};

type Person = { nombre: string | null; apellido: string | null; email: string | null };

function AdminSolicitudes() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [admins, setAdmins] = useState<Array<{ id: string } & Person>>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [pendingFinalization, setPendingFinalization] = useState<Row | null>(null);
  const [collaboratorId, setCollaboratorId] = useState("none");

  const load = async () => {
    const { data } = await supabase
      .from("solicitudes")
      .select("*")
      .order("fecha_creacion", { ascending: false });
    const list = (data as Row[]) ?? [];
    const ids = Array.from(
      new Set(
        list
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
      list.forEach((r) => {
        r.profile = map.get(r.usuario_id) as any;
        if (r.profile?.area_id) r.profile.area = areaMap.get(r.profile.area_id) ?? r.profile.area;
        r.responsable = r.asignado_a ? map.get(r.asignado_a) : undefined;
        r.colaborador = r.colaborador_id ? map.get(r.colaborador_id) : undefined;
      });
    }
    const { data: roleRows } = await supabase.from("user_roles").select("user_id").eq("role", "administrador");
    const adminIds = (roleRows ?? []).map((r) => r.user_id).filter((id) => id !== user?.id);
    if (adminIds.length) {
      const { data: adminProfiles } = await supabase.from("profiles").select("id, nombre, apellido, email").in("id", adminIds);
      setAdmins((adminProfiles ?? []) as Array<{ id: string } & Person>);
    } else {
      setAdmins([]);
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
  }, [user?.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterEstado !== "all" && r.estado !== filterEstado) return false;
      if (onlyMine && r.asignado_a !== user?.id) return false;
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
  }, [rows, q, filterEstado, onlyMine, user?.id]);

  const changeEstado = async (id: string, estado: Row["estado"], selectedCollaboratorId: string | null = null) => {
    const { error } = await supabase.from("solicitudes").update({
      estado,
      ...(estado === "finalizado" ? { colaborador_id: selectedCollaboratorId } : {}),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Estado actualizado");
      await load();
    }
  };

  const requestEstadoChange = (row: Row, estado: Row["estado"]) => {
    if (estado === "finalizado" && row.estado !== "finalizado") {
      setPendingFinalization(row);
      setCollaboratorId("none");
      return;
    }
    void changeEstado(row.id, estado);
  };

  const confirmFinalization = async () => {
    if (!pendingFinalization) return;
    await changeEstado(pendingFinalization.id, "finalizado", collaboratorId === "none" ? null : collaboratorId);
    setPendingFinalization(null);
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
          <Button type="button" variant={onlyMine ? "default" : "outline"} onClick={() => setOnlyMine((value) => !value)}>
            Mis solicitudes asignadas
          </Button>
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
                  <th className="px-3 py-2 font-medium">FECHA / HORA</th>
                  <th className="px-3 py-2 font-medium">Empleado</th>
                  <th className="px-3 py-2 font-medium">Área</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Urgencia</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Responsable</th>
                  <th className="px-3 py-2 font-medium">Colaborador</th>
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
                        hour12: false,
                      })}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {r.profile?.nombre} {r.profile?.apellido}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{r.profile?.area}</td>
                    <td className="max-w-xs truncate px-3 py-3">{r.motivo}</td>
                    <td className="px-3 py-3"><UrgenciaBadge value={r.urgencia} /></td>
                    <td className="px-3 py-3">
                      <Select value={r.estado} onValueChange={(v) => requestEstadoChange(r, v as Row["estado"])}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {r.estado === "cancelado" ? (
                            <SelectItem value="visto">Visto</SelectItem>
                          ) : r.estado === "visto" ? (
                            <SelectItem value="visto">Visto</SelectItem>
                          ) : (
                            <>
                              <SelectItem value="en_espera">En espera</SelectItem>
                              <SelectItem value="en_proceso">En proceso</SelectItem>
                              <SelectItem value="finalizado">Finalizado</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {r.responsable ? `${r.responsable.nombre ?? ""} ${r.responsable.apellido ?? ""}`.trim() : "Sin asignar"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.estado === "finalizado" && r.colaborador ? `${r.colaborador.nombre ?? ""} ${r.colaborador.apellido ?? ""}`.trim() : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(r)} aria-label="Ver detalle" title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {r.estado !== "finalizado" && r.estado !== "visto" && (
                          <Button size="sm" variant="ghost" onClick={() => requestEstadoChange(r, r.estado === "cancelado" ? "visto" : "finalizado")}>
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
                  <div className="break-words font-medium">{detail.profile?.nombre} {detail.profile?.apellido}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Área</div>
                  <div className="break-words font-medium">{detail.profile?.area ?? "Sin área"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="break-words font-medium">{detail.profile?.email}</div>
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
                <p className="break-words whitespace-pre-wrap rounded-lg border border-border bg-background p-3">
                  {detail.descripcion}
                </p>
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

      <Dialog open={!!pendingFinalization} onOpenChange={(open) => !open && setPendingFinalization(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">¿Te ayudó otro técnico con este pedido?</p>
            <Select value={collaboratorId} onValueChange={setCollaboratorId}>
              <SelectTrigger><SelectValue placeholder="Seleccioná un colaborador (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>{admin.nombre} {admin.apellido}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingFinalization(null)}>Cancelar</Button>
              <Button onClick={() => void confirmFinalization()}>Finalizar solicitud</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
