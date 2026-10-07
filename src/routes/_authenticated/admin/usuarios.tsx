import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Users, Pencil, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type Role = "administrador" | "empleado";
type Area = { id: string; nombre_completo: string; nombre_corto: string };
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
  area: string | null;
  area_id: string | null;
  area_nombre_corto: string | null;
  area_nombre_completo: string | null;
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
  const [areas, setAreas] = useState<Area[]>([]);
  const [areasLoadError, setAreasLoadError] = useState<string | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const editDialogContentRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    areaId: "none",
    role: "empleado" as Role,
  });

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: areaOptions, error: areaError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, nombre, apellido, email, area, area_id, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("areas").select("id, nombre_completo, nombre_corto").order("nombre_corto"),
      ]);
    setAreas(areaOptions ?? []);
    setAreasLoadError(areaError?.message ?? null);
    if (areaError) toast.error(`No se pudieron cargar las áreas: ${areaError.message}`);
    const rolesMap = new Map<string, Role>();
    (roles ?? []).forEach((r) => rolesMap.set(r.user_id, r.role as Role));
    const areasMap = new Map((areaOptions ?? []).map((area) => [area.id, area]));
    const merged: Row[] = (profiles ?? []).map((p) => ({
      ...p,
      area_nombre_corto: areasMap.get(p.area_id)?.nombre_corto ?? null,
      area_nombre_completo: areasMap.get(p.area_id)?.nombre_completo ?? null,
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
          [
            row.nombre,
            row.apellido,
            row.email,
            row.area,
            row.area_nombre_corto,
            row.area_nombre_completo,
          ]
            .filter(Boolean)
            .join(" "),
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
      areaId:
        areas.find((area) => area.id === r.area_id)?.id ??
        areas.find((area) => area.nombre_completo === r.area || area.nombre_corto === r.area)?.id ??
        "none",
      role: r.role,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (areasLoadError) {
      toast.error("No se pueden guardar los cambios porque no se pudieron cargar las áreas.");
      return;
    }
    const selectedArea = areas.find((area) => area.id === form.areaId);
    setSaving(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        nombre: form.nombre,
        apellido: form.apellido,
        area_id: selectedArea?.id ?? null,
        area: selectedArea?.nombre_corto ?? null,
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
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Administrá los usuarios y roles del sistema.
          </p>
        </div>
      </div>

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
                placeholder="Nombre, apellido, email o área..."
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
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Creado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {rows.length === 0 ? "Sin usuarios." : "No hay usuarios para estos filtros."}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.nombre ?? "—"}</td>
                    <td className="px-4 py-3">{r.apellido ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-3">{r.area_nombre_corto ?? r.area ?? "—"}</td>
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
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : filteredRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? "Sin usuarios." : "No hay usuarios para estos filtros."}
            </p>
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
                    <dt className="text-xs text-muted-foreground">Área</dt>
                    <dd className="break-words">{r.area_nombre_corto ?? r.area ?? "—"}</dd>
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
        <DialogContent ref={editDialogContentRef}>
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
              <Label htmlFor="usuario-area">Área</Label>
              <Popover open={areaOpen} onOpenChange={setAreaOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="usuario-area"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={areaOpen}
                    disabled={Boolean(areasLoadError)}
                    className="w-full justify-between font-normal"
                  >
                    {areas.find((area) => area.id === form.areaId)?.nombre_corto ??
                      (form.areaId === "none" ? "Sin área" : "Seleccioná un área")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  avoidCollisions={false}
                  portalContainer={editDialogContentRef.current}
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command
                    filter={(value, search) => {
                      if (value === "none") {
                        return normalize("Sin área").includes(normalize(search)) ? 1 : 0;
                      }
                      const area = areas.find((option) => option.id === value);
                      return area &&
                        normalize(`${area.nombre_corto} ${area.nombre_completo}`).includes(
                          normalize(search),
                        )
                        ? 1
                        : 0;
                    }}
                  >
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList className="max-h-60">
                      <CommandEmpty>No se encontraron áreas.</CommandEmpty>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setForm({ ...form, areaId: "none" });
                          setAreaOpen(false);
                        }}
                      >
                        <Check
                          className={
                            form.areaId === "none"
                              ? "mr-2 h-4 w-4 opacity-100"
                              : "mr-2 h-4 w-4 opacity-0"
                          }
                        />
                        Sin área
                      </CommandItem>
                      {areas.map((area) => (
                        <CommandItem
                          key={area.id}
                          value={area.id}
                          onSelect={() => {
                            setForm({ ...form, areaId: area.id });
                            setAreaOpen(false);
                          }}
                        >
                          <Check
                            className={
                              form.areaId === area.id
                                ? "mr-2 h-4 w-4 opacity-100"
                                : "mr-2 h-4 w-4 opacity-0"
                            }
                          />
                          {area.nombre_corto}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDeletion} onOpenChange={(open) => !open && setPendingDeletion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Eliminar a {pendingDeletion?.nombre} {pendingDeletion?.apellido} (
            {pendingDeletion?.email})? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeletion(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void removeUser()} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
