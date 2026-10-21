import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UnidadSelector, type UnidadOption } from "@/components/unidad-selector";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/empty-state";

type Role = "administrador" | "empleado";
type UnidadOptionWithCargo = UnidadOption & { cargo_jefe: string };
const MOBILE_PAGE_SIZE = 3;
const DESKTOP_PAGE_SIZE = 7;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getLocalDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type Row = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  unidad_id: string | null;
  es_jefe: boolean;
  solicitud_jefe: "pendiente" | "rechazada" | null;
  unidad_display: string | null;
  created_at: string;
  role: Role;
};

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios - SIG" },
      { name: "description", content: "Administración de usuarios del portal de soporte." },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<Row[]>([]);
  const [unidades, setUnidades] = useState<UnidadOptionWithCargo[]>([]);
  const [unidadesLoadError, setUnidadesLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    unidadId: "none",
    role: "empleado" as Role,
  });

  const load = async () => {
    setLoading(true);
    const [
      { data: profiles, error: profilesError },
      { data: roles, error: rolesError },
      { data: unitOptions, error: unitsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nombre, apellido, email, unidad_id, es_jefe, solicitud_jefe, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("unidades_arbol").select("id, ruta, cargo_jefe, activo").order("ruta"),
    ]);
    setUnidades((unitOptions ?? []) as UnidadOptionWithCargo[]);
    setUnidadesLoadError(unitsError?.message ?? null);
    if (profilesError) toast.error(`No se pudieron cargar los usuarios: ${profilesError.message}`);
    if (rolesError) toast.error(`No se pudieron cargar los roles: ${rolesError.message}`);
    if (unitsError) toast.error(`No se pudieron cargar las unidades: ${unitsError.message}`);
    const rolesMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => rolesMap.set(r.user_id, r.role as Role));
    const unidadesMap = new Map((unitOptions ?? []).map((unidad) => [unidad.id, unidad]));
    const merged: Row[] = (profiles ?? []).map((p) => ({
      ...p,
      unidad_display: p.unidad_id
        ? ((p.es_jefe
            ? unidadesMap.get(p.unidad_id)?.cargo_jefe
            : unidadesMap.get(p.unidad_id)?.ruta) ?? null)
        : null,
      role: rolesMap.get(p.id) ?? "empleado",
    }));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [isMobile]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalize(search.trim());
    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        normalize(
          [row.nombre, row.apellido, row.email, row.unidad_display].filter(Boolean).join(" "),
        ).includes(normalizedSearch);
      const createdDate = getLocalDateKey(row.created_at);
      const matchesFrom = !createdFrom || Boolean(createdDate && createdDate >= createdFrom);
      const matchesTo = !createdTo || Boolean(createdDate && createdDate <= createdTo);
      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [rows, search, createdFrom, createdTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, createdFrom, createdTo]);

  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(1, totalPages)));
  }, [totalPages]);

  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      nombre: r.nombre ?? "",
      apellido: r.apellido ?? "",
      unidadId: r.unidad_id ?? "none",
      role: r.role,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (unidadesLoadError) {
      toast.error("No se pueden guardar los cambios porque no se pudieron cargar las unidades.");
      return;
    }
    const selectedUnit = unidades.find((unidad) => unidad.id === form.unidadId);
    setSaving(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        nombre: form.nombre,
        apellido: form.apellido,
        unidad_id: selectedUnit?.id ?? null,
        ...(!selectedUnit && editing.solicitud_jefe ? { solicitud_jefe: null } : {}),
        ...(editing.es_jefe && editing.unidad_id !== (selectedUnit?.id ?? null)
          ? { es_jefe: false }
          : {}),
      })
      .eq("id", editing.id);
    if (pErr) {
      toast.error(pErr.message);
      setSaving(false);
      return;
    }
    if (form.role !== editing.role) {
      await supabase.from("user_roles").delete().eq("user_id", editing.id);
      const { error: rErr } = await supabase
        .from("user_roles")
        .insert({ user_id: editing.id, role: form.role });
      if (rErr) {
        toast.error(rErr.message);
        setSaving(false);
        return;
      }
    }
    toast.success("Usuario actualizado");
    setSaving(false);
    setEditing(null);
    load();
  };

  const removeUser = async () => {
    if (!pendingDeletion) return;
    setDeleting(true);
    const { error } = await supabase.rpc("eliminar_usuario", { _user_id: pendingDeletion.id });
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Usuario eliminado");
    setPendingDeletion(null);
    await load();
  };

  return (
    <AppShell>
      <PageHeader
        title="Usuarios"
        description="Administrá los usuarios y roles del sistema."
        icon={Users}
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="usuarios-search">Buscar usuarios</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="usuarios-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre, apellido, email o unidad..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usuarios-created-from">Creado desde</Label>
            <Input
              id="usuarios-created-from"
              type="date"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(event) => setCreatedFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usuarios-created-to">Creado hasta</Label>
            <Input
              id="usuarios-created-to"
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(event) => setCreatedTo(event.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:col-span-2 lg:col-span-1"
            onClick={() => {
              setSearch("");
              setCreatedFrom("");
              setCreatedTo("");
            }}
            disabled={!search && !createdFrom && !createdTo}
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Apellido</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Unidad</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }, (_, row) => (
                  <tr key={row} className="border-t border-border">
                    {Array.from({ length: 7 }, (_, cell) => (
                      <td key={cell} className="px-4 py-4">
                        <Skeleton className={`h-4 ${cell === 2 ? "w-full" : "w-3/4"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      title={
                        rows.length === 0
                          ? "Todavía no hay usuarios"
                          : "No hay resultados para estos filtros"
                      }
                      description={
                        rows.length === 0
                          ? "Los usuarios aparecerán en esta lista cuando se registren."
                          : "Probá con otros términos o limpiá los filtros."
                      }
                      icon={Users}
                      action={
                        rows.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearch("");
                              setCreatedFrom("");
                              setCreatedTo("");
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.nombre ?? "—"}</td>
                    <td className="px-4 py-3">{r.apellido ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-3">{r.unidad_display ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.role === "administrador"
                            ? "rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80"
                        }
                      >
                        {r.role === "administrador" ? "Administrador" : "Empleado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEdit(r)}
                          aria-label={`Editar usuario ${r.email ?? ""}`}
                          title="Editar usuario"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setPendingDeletion(r)}
                          aria-label={`Eliminar usuario ${r.email ?? ""}`}
                          title="Eliminar usuario"
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-3 md:hidden">
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-border p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <EmptyState
              title={
                rows.length === 0
                  ? "Todavía no hay usuarios"
                  : "No hay resultados para estos filtros"
              }
              description={
                rows.length === 0
                  ? "Los usuarios aparecerán en esta lista cuando se registren."
                  : "Probá con otros términos o limpiá los filtros."
              }
              icon={Users}
              action={
                rows.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setCreatedFrom("");
                      setCreatedTo("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                ) : undefined
              }
            />
          ) : (
            pageRows.map((r) => (
              <div key={r.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">
                      {[r.nombre, r.apellido].filter(Boolean).join(" ") || "Sin nombre"}
                    </h2>
                    <p className="break-all text-sm text-muted-foreground">{r.email ?? "—"}</p>
                  </div>
                  <span
                    className={
                      r.role === "administrador"
                        ? "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                        : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80"
                    }
                  >
                    {r.role === "administrador" ? "Administrador" : "Empleado"}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Unidad</dt>
                    <dd className="break-words">{r.unidad_display ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Creado</dt>
                    <dd>{new Date(r.created_at).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(r)}
                    aria-label={`Editar usuario ${r.email ?? ""}`}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPendingDeletion(r)}
                    aria-label={`Eliminar usuario ${r.email ?? ""}`}
                  >
                    <X className="mr-2 h-4 w-4 text-destructive" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {!loading && totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center text-sm text-muted-foreground sm:text-left">
              Mostrando {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredRows.length)} de {filteredRows.length}{" "}
              usuarios
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Anterior
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) =>
                currentPage > 3 ? currentPage - 2 + index : index + 1,
              )
                .filter((page) => page <= totalPages)
                .map((page) => (
                  <Button
                    key={page}
                    type="button"
                    size="sm"
                    variant={page === currentPage ? "default" : "outline"}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Unidad</Label>
              <UnidadSelector
                unidades={unidades}
                value={form.unidadId === "none" ? "" : form.unidadId}
                onValueChange={(unidadId) => setForm({ ...form, unidadId })}
                disabled={Boolean(unidadesLoadError)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm({ ...form, unidadId: "none" })}
              >
                Sin unidad asignada
              </Button>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">Administrador</SelectItem>
                  <SelectItem value="empleado">Empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Spinner size="sm" />}
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDeletion}
        onOpenChange={(open) => !open && !deleting && setPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
            ¿Eliminar a {pendingDeletion?.nombre} {pendingDeletion?.apellido} (
            {pendingDeletion?.email})? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void removeUser();
              }}
            >
              {deleting && <Spinner size="sm" />}
              {deleting ? "Eliminando…" : "Eliminar usuario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
