import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UnidadSelector } from "@/components/unidad-selector";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  getUnidadDescendantIds,
  normalizeText,
  UNIDAD_TIPOS,
  unidadTipoLabels,
  type UnidadNode,
  type UnidadTipo,
} from "@/lib/unidades";

export const Route = createFileRoute("/_authenticated/admin/organigrama")({
  head: () => ({
    meta: [
      { title: "Organigrama - SIG" },
      { name: "description", content: "Administración del organigrama institucional." },
    ],
  }),
  component: OrganigramaPage,
});

const unidadSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá un nombre de al menos 2 caracteres.").max(160),
  tipo: z.enum(UNIDAD_TIPOS),
  padre_id: z.string().uuid().nullable(),
  cargo_jefe: z.string().trim().min(2, "Ingresá el cargo de la jefatura.").max(160),
});

type ProfileRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  unidad_id: string | null;
  es_jefe: boolean;
  solicitud_jefe: "pendiente" | "rechazada" | null;
};

type UnitCounts = { usuarios: number; tickets: number };

type UnidadForm = {
  nombre: string;
  tipo: UnidadTipo;
  padre_id: string | null;
  cargo_jefe: string;
};

const emptyForm: UnidadForm = {
  nombre: "",
  tipo: "departamento",
  padre_id: null,
  cargo_jefe: "",
};

function compareCodes(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.min(leftParts.length, rightParts.length); index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return leftParts.length - rightParts.length;
}

function suggestCargo(tipo: UnidadTipo, nombre: string) {
  const sujeto = nombre
    .trim()
    .replace(/^(secretaría|subsecretaría|dirección|subdirección|área)\s+(de\s+)?/i, "");
  switch (tipo) {
    case "ministerio":
      return `Ministro/a de ${sujeto}`;
    case "secretaria":
      return `Secretario/a de ${sujeto}`;
    case "subsecretaria":
      return `Subsecretario/a de ${sujeto}`;
    case "direccion":
      return `Director/a de ${sujeto}`;
    case "subdireccion":
      return `Subdirector/a de ${sujeto}`;
    case "departamento":
      return `Jefe/a del Departamento de ${sujeto}`;
    case "area":
      return `Responsable del Área de ${sujeto}`;
    case "organismo":
      return `Titular del ${nombre.trim()}`;
    case "programa":
      return `Coordinador/a de ${nombre.trim()}`;
    case "centro":
      return `Responsable del ${nombre.trim()}`;
  }
}

function formatError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "Ya existe una unidad con ese nombre en esta dependencia.";
  if (
    error.code === "23514" &&
    /ciclo|descendiente|debajo de sí misma/i.test(error.message ?? "")
  ) {
    return "No se puede mover una unidad debajo de sí misma ni de una dependencia.";
  }
  if (error.code === "23514") return "Los datos no cumplen las reglas del organigrama.";
  if (error.code === "23503")
    return "No se puede eliminar: la unidad todavía tiene registros asociados.";
  if (error.code === "42501") return "No tenés permisos para realizar esta acción.";
  return error.message || "No se pudo completar la operación.";
}

function OrganigramaPage() {
  const isMobile = useIsMobile();
  const [unidades, setUnidades] = useState<UnidadNode[]>([]);
  const [perfiles, setPerfiles] = useState<ProfileRow[]>([]);
  const [unitCounts, setUnitCounts] = useState<Map<string, UnitCounts>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<UnidadNode | null>(null);
  const [chiefToRemove, setChiefToRemove] = useState<ProfileRow | null>(null);
  const [pendingChiefReplacement, setPendingChiefReplacement] = useState<{
    perfil: ProfileRow;
    currentChiefName: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UnidadForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [unidadesResult, perfilesResult, summaryResult] = await Promise.all([
      supabase
        .from("unidades_arbol")
        .select("id, padre_id, nombre, tipo, cargo_jefe, activo, orden, nivel, codigo, ruta"),
      supabase
        .from("profiles")
        .select("id, nombre, apellido, email, unidad_id, es_jefe, solicitud_jefe")
        .or("es_jefe.eq.true,solicitud_jefe.eq.pendiente"),
      supabase.rpc("resumen_unidades"),
    ]);

    const loadError = unidadesResult.error ?? perfilesResult.error ?? summaryResult.error;
    if (loadError) {
      toast.error(`No se pudo cargar el organigrama: ${loadError.message}`);
      setLoading(false);
      return;
    }

    const nextUnidades = ((unidadesResult.data ?? []) as UnidadNode[]).sort((a, b) =>
      compareCodes(a.codigo, b.codigo),
    );
    setUnidades(nextUnidades);
    setPerfiles((perfilesResult.data ?? []) as ProfileRow[]);
    setUnitCounts(
      new Map(
        (summaryResult.data ?? []).map((summary) => [
          summary.unidad_id,
          { usuarios: Number(summary.usuarios), tickets: Number(summary.tickets) },
        ]),
      ),
    );
    setExpanded((current) =>
      current.size
        ? current
        : new Set(nextUnidades.filter((unidad) => unidad.nivel === 1).map((unidad) => unidad.id)),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const childrenByParent = useMemo(() => {
    const result = new Map<string | null, UnidadNode[]>();
    unidades.forEach((unidad) => {
      const siblings = result.get(unidad.padre_id) ?? [];
      siblings.push(unidad);
      result.set(unidad.padre_id, siblings);
    });
    result.forEach((siblings) =>
      siblings.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)),
    );
    return result;
  }, [unidades]);

  const leadersByUnit = useMemo(() => {
    const result = new Map<string, ProfileRow[]>();
    perfiles.forEach((perfil) => {
      if (!perfil.unidad_id) return;
      const assigned = result.get(perfil.unidad_id) ?? [];
      assigned.push(perfil);
      result.set(perfil.unidad_id, assigned);
    });
    return result;
  }, [perfiles]);

  const unitMap = useMemo(() => new Map(unidades.map((unidad) => [unidad.id, unidad])), [unidades]);
  const descendantsByUnit = useMemo(
    () =>
      new Map(unidades.map((unidad) => [unidad.id, getUnidadDescendantIds(unidad.id, unidades)])),
    [unidades],
  );
  const normalizedSearch = normalizeText(search.trim());
  const visibleIds = useMemo(() => {
    if (!normalizedSearch) return new Set(unidades.map((unidad) => unidad.id));
    const visible = new Set<string>();
    unidades.forEach((unidad) => {
      if (!normalizeText(unidad.nombre).includes(normalizedSearch)) return;
      let current: UnidadNode | undefined = unidad;
      while (current) {
        visible.add(current.id);
        current = current.padre_id ? unitMap.get(current.padre_id) : undefined;
      }
    });
    return visible;
  }, [normalizedSearch, unidades, unitMap]);
  const pendingRequests = perfiles.filter((perfil) => perfil.solicitud_jefe === "pendiente");

  const openCreate = (parentId: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, padre_id: parentId });
    setDialogMode("create");
  };

  const openEdit = (unidad: UnidadNode) => {
    setEditingId(unidad.id);
    setForm({
      nombre: unidad.nombre,
      tipo: unidad.tipo,
      padre_id: unidad.padre_id,
      cargo_jefe: unidad.cargo_jefe,
    });
    setDialogMode("edit");
  };

  const submitUnidad = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = unidadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los datos ingresados.");
      return;
    }
    if (dialogMode === "create" && !parsed.data.padre_id) {
      toast.error("Seleccioná la dependencia de la nueva unidad.");
      return;
    }
    setSaving(true);
    setSavingAction("guardar-unidad");
    const result =
      dialogMode === "create"
        ? await supabase.from("unidades").insert({
            ...parsed.data,
            orden:
              Math.max(
                0,
                ...(childrenByParent.get(parsed.data.padre_id) ?? []).map((unidad) => unidad.orden),
              ) + 1,
          })
        : await supabase
            .from("unidades")
            .update(parsed.data)
            .eq("id", editingId ?? "");
    setSaving(false);
    setSavingAction(null);
    if (result.error) {
      toast.error(formatError(result.error));
      return;
    }
    toast.success(dialogMode === "create" ? "Unidad agregada." : "Unidad actualizada.");
    setDialogMode(null);
    await load();
  };

  const moveUnit = async (unidad: UnidadNode, direction: -1 | 1) => {
    const siblings = childrenByParent.get(unidad.padre_id) ?? [];
    const index = siblings.findIndex((item) => item.id === unidad.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setSaving(true);
    setSavingAction(`${direction < 0 ? "subir" : "bajar"}-${unidad.id}`);
    for (const [position, sibling] of reordered.entries()) {
      const { error } = await supabase
        .from("unidades")
        .update({ orden: (position + 1) * 10 })
        .eq("id", sibling.id);
      if (error) {
        toast.error(formatError(error));
        setSaving(false);
        setSavingAction(null);
        await load();
        return;
      }
    }
    setSaving(false);
    setSavingAction(null);
    toast.success("Orden de las unidades actualizado.");
    await load();
  };

  const toggleActive = async (unidad: UnidadNode) => {
    setSaving(true);
    setSavingAction(`estado-${unidad.id}`);
    const { error } = await supabase
      .from("unidades")
      .update({ activo: !unidad.activo })
      .eq("id", unidad.id);
    setSaving(false);
    setSavingAction(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(unidad.activo ? "Unidad desactivada." : "Unidad reactivada.");
    await load();
  };

  const deleteUnit = async (unidad: UnidadNode) => {
    const descendants = childrenByParent.get(unidad.id) ?? [];
    const assignedCount = unitCounts.get(unidad.id)?.usuarios ?? 0;
    const ticketsCount = unitCounts.get(unidad.id)?.tickets ?? 0;
    if (descendants.length || assignedCount || ticketsCount || !unidad.padre_id) return;
    setUnitToDelete(unidad);
  };

  const confirmDeleteUnit = async () => {
    if (!unitToDelete) return;
    setSaving(true);
    setSavingAction(`eliminar-${unitToDelete.id}`);
    const { error } = await supabase.from("unidades").delete().eq("id", unitToDelete.id);
    setSaving(false);
    setSavingAction(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Unidad eliminada.");
    setUnitToDelete(null);
    await load();
  };

  const removeChief = async (perfil: ProfileRow) => {
    setChiefToRemove(perfil);
  };

  const confirmRemoveChief = async () => {
    if (!chiefToRemove) return;
    setSaving(true);
    setSavingAction(`quitar-jefatura-${chiefToRemove.id}`);
    const { error } = await supabase
      .from("profiles")
      .update({ es_jefe: false })
      .eq("id", chiefToRemove.id);
    setSaving(false);
    setSavingAction(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Jefatura quitada.");
    setChiefToRemove(null);
    await load();
  };

  const resolveRequest = async (
    perfil: ProfileRow,
    aprobar: boolean,
    confirmedReplacement = false,
  ) => {
    const unidad = perfil.unidad_id ? unitMap.get(perfil.unidad_id) : undefined;
    if (aprobar && unidad) {
      const currentChief = (leadersByUnit.get(unidad.id) ?? []).find(
        (candidate) => candidate.es_jefe && candidate.id !== perfil.id,
      );
      if (currentChief) {
        const name =
          `${currentChief.nombre ?? ""} ${currentChief.apellido ?? ""}`.trim() ||
          currentChief.email ||
          "la persona actual";
        if (!confirmedReplacement) {
          setPendingChiefReplacement({ perfil, currentChiefName: name });
          return;
        }
      }
    }
    setSaving(true);
    setSavingAction(`${aprobar ? "aprobar" : "rechazar"}-${perfil.id}`);
    const { error } = await supabase.rpc("resolver_solicitud_jefatura", {
      _profile_id: perfil.id,
      _aprobar: aprobar,
    });
    setSaving(false);
    setSavingAction(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(aprobar ? "Solicitud aprobada." : "Solicitud rechazada.");
    setPendingChiefReplacement(null);
    await load();
  };

  const changeFormType = (tipo: UnidadTipo) => {
    setForm((current) => ({
      ...current,
      tipo,
      cargo_jefe: suggestCargo(tipo, current.nombre),
    }));
  };

  const setExpandAll = (open: boolean) => {
    setExpanded(open ? new Set(unidades.map((unidad) => unidad.id)) : new Set());
  };

  const renderUnit = (unidad: UnidadNode, depth: number): React.ReactNode => {
    if (!visibleIds.has(unidad.id)) return null;
    const children = (childrenByParent.get(unidad.id) ?? []).filter((child) =>
      visibleIds.has(child.id),
    );
    const isOpen = normalizedSearch.length > 0 || expanded.has(unidad.id);
    const chiefs = (leadersByUnit.get(unidad.id) ?? []).filter((perfil) => perfil.es_jefe);
    const membersCount = unitCounts.get(unidad.id)?.usuarios ?? 0;
    const relatedTickets = unitCounts.get(unidad.id)?.tickets ?? 0;
    const canDelete =
      !children.length && !membersCount && !relatedTickets && Boolean(unidad.padre_id);
    const siblings = childrenByParent.get(unidad.padre_id) ?? [];
    const index = siblings.findIndex((sibling) => sibling.id === unidad.id);

    return (
      <div
        key={unidad.id}
        className="rounded-xl border bg-card p-3 md:rounded-none md:border-0 md:border-b md:px-2 md:py-2"
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(17rem,2fr)_minmax(10rem,1fr)_minmax(12rem,1.2fr)_minmax(8rem,0.8fr)_minmax(14rem,1.4fr)] md:items-center md:gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {children.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-10 w-10 shrink-0"
                aria-label={isOpen ? `Contraer ${unidad.nombre}` : `Expandir ${unidad.nombre}`}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(unidad.id)) next.delete(unidad.id);
                    else next.add(unidad.id);
                    return next;
                  })
                }
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <span className="w-10 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{unidad.codigo}</span>
                <span className="font-medium">{unidad.nombre}</span>
                <Badge variant="outline">{unidadTipoLabels[unidad.tipo]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{unidad.cargo_jefe}</p>
              {chiefs.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <UserRoundCheck className="h-3.5 w-3.5" />
                  Jefe/a:{" "}
                  {chiefs.map((perfil, chiefIndex) => (
                    <span key={perfil.id}>
                      {chiefIndex > 0 ? ", " : ""}
                      {`${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() ||
                        perfil.email ||
                        "Sin nombre"}
                      <button
                        type="button"
                        className="ml-1 inline-flex min-h-10 items-center text-destructive underline"
                        onClick={() => void removeChief(perfil)}
                        disabled={saving}
                      >
                        {savingAction === `quitar-jefatura-${perfil.id}` ? (
                          <Spinner size="sm" />
                        ) : (
                          "Quitar"
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Sin jefe/a asignado/a</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground md:hidden">
                {membersCount} usuario{membersCount === 1 ? "" : "s"} · {relatedTickets} ticket
                {relatedTickets === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="hidden text-sm text-muted-foreground md:block">
            {membersCount} usuario{membersCount === 1 ? "" : "s"}
          </div>
          <div className="hidden text-sm text-muted-foreground md:block">{unidad.ruta}</div>
          <div>
            <Badge variant={unidad.activo ? "default" : "secondary"}>
              {unidad.activo ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openCreate(unidad.id)}
              disabled={saving}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar dependencia
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Editar ${unidad.nombre}`}
              onClick={() => openEdit(unidad)}
              disabled={saving}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Subir ${unidad.nombre}`}
              onClick={() => void moveUnit(unidad, -1)}
              disabled={saving || index <= 0}
            >
              {savingAction === `subir-${unidad.id}` ? (
                <Spinner size="sm" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Bajar ${unidad.nombre}`}
              onClick={() => void moveUnit(unidad, 1)}
              disabled={saving || index === siblings.length - 1}
            >
              {savingAction === `bajar-${unidad.id}` ? (
                <Spinner size="sm" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void toggleActive(unidad)}
              disabled={saving}
            >
              {savingAction === `estado-${unidad.id}` ? (
                <Spinner size="sm" />
              ) : (
                <Power className="mr-1 h-3.5 w-3.5" />
              )}
              {savingAction === `estado-${unidad.id}`
                ? "Actualizando…"
                : unidad.activo
                  ? "Desactivar"
                  : "Reactivar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${unidad.nombre}`}
              onClick={() => void deleteUnit(unidad)}
              disabled={saving || !canDelete}
            >
              {savingAction === `eliminar-${unidad.id}` ? (
                <Spinner size="sm" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {!canDelete && (
            <p className="text-xs text-muted-foreground md:col-start-5">
              {!unidad.padre_id
                ? "La raíz del organigrama no se puede eliminar."
                : `No se puede eliminar: ${children.length} dependencias, ${membersCount} usuarios y ${relatedTickets} tickets. Podés desactivarla.`}
            </p>
          )}
        </div>
        {isOpen && children.length > 0 && (
          <div className="mt-3 space-y-3 md:mt-0 md:space-y-0">
            {children.map((child) => renderUnit(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppShell>
      <PageHeader
        title="Organigrama"
        description="Administrá las unidades, sus dependencias y las jefaturas."
        icon={Users}
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-1.5 sm:max-w-md">
            <Label htmlFor="organigrama-busqueda">Buscar unidad</Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="organigrama-busqueda"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Filtrar por nombre..."
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setExpandAll(true)}>
              Expandir todo
            </Button>
            <Button type="button" variant="outline" onClick={() => setExpandAll(false)}>
              Contraer todo
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mb-6 overflow-hidden p-3 md:p-5">
        <div className="mb-2 hidden grid-cols-[minmax(17rem,2fr)_minmax(10rem,1fr)_minmax(12rem,1.2fr)_minmax(8rem,0.8fr)_minmax(14rem,1.4fr)] gap-3 border-b px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
          <span>Unidad / cargo</span>
          <span>Usuarios</span>
          <span>Ruta</span>
          <span>Estado</span>
          <span>Acciones</span>
        </div>
        {loading ? (
          <div className="space-y-2 py-4" aria-label="Cargando organigrama">
            {Array.from({ length: isMobile ? 3 : 7 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg border p-4">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : unidades.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay unidades cargadas. Aplicá las migraciones y la semilla del organigrama.
          </p>
        ) : (
          <div className="space-y-3 md:space-y-0">
            {(childrenByParent.get(null) ?? []).map((root) => renderUnit(root, 0))}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Solicitudes de jefatura</h2>
          <p className="text-sm text-muted-foreground">
            Las aprobaciones reemplazan a la jefatura actual de la unidad, si la hubiera.
          </p>
        </div>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((perfil) => {
              const unidad = perfil.unidad_id ? unitMap.get(perfil.unidad_id) : undefined;
              return (
                <div
                  key={perfil.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">
                      {`${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() ||
                        perfil.email ||
                        "Usuario"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {unidad?.ruta ?? "Sin unidad asignada"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void resolveRequest(perfil, true)}
                      disabled={saving || !unidad?.activo}
                    >
                      {savingAction === `aprobar-${perfil.id}` ? (
                        <>
                          <Spinner size="sm" />
                          Aprobando…
                        </>
                      ) : (
                        "Aprobar"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void resolveRequest(perfil, false)}
                      disabled={saving}
                    >
                      {savingAction === `rechazar-${perfil.id}` ? (
                        <>
                          <Spinner size="sm" />
                          Rechazando…
                        </>
                      ) : (
                        "Rechazar"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTypeSelectOpen(false);
            setDialogMode(null);
          }
        }}
      >
        <DialogContent className="grid-cols-[minmax(0,1fr)] w-[calc(100%-2rem)] min-w-0 max-w-lg overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Agregar dependencia" : "Editar unidad"}
            </DialogTitle>
          </DialogHeader>
          <form className="min-w-0 space-y-4" onSubmit={submitUnidad}>
            <div className="space-y-1.5">
              <Label htmlFor="unidad-nombre">Nombre</Label>
              <Input
                id="unidad-nombre"
                className="w-full min-w-0"
                value={form.nombre}
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    nombre: event.target.value,
                    cargo_jefe:
                      current.cargo_jefe && dialogMode === "edit"
                        ? current.cargo_jefe
                        : suggestCargo(current.tipo, event.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                open={typeSelectOpen}
                onOpenChange={setTypeSelectOpen}
                value={form.tipo}
                onValueChange={(value) => changeFormType(value as UnidadTipo)}
              >
                <SelectTrigger
                  className="w-full min-w-0"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.focus();
                    setTypeSelectOpen((open) => !open);
                  }}
                  onClick={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setTypeSelectOpen((open) => !open);
                    } else if (event.key === "ArrowDown" && !typeSelectOpen) {
                      event.preventDefault();
                      setTypeSelectOpen(true);
                    } else if (event.key === "Escape" && typeSelectOpen) {
                      event.preventDefault();
                      setTypeSelectOpen(false);
                    }
                  }}
                >
                  <SelectValue placeholder="Seleccioná el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {UNIDAD_TIPOS.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {unidadTipoLabels[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dependencia</Label>
              {dialogMode === "edit" && !form.padre_id ? (
                <Select value="__root__" disabled>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">Sin dependencia (raíz)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <UnidadSelector
                  unidades={unidades
                    .filter((unidad) => {
                      if (!editingId) return unidad.activo;
                      return !descendantsByUnit.get(editingId)?.has(unidad.id);
                    })
                    .map((unidad) => ({
                      id: unidad.id,
                      ruta: unidad.ruta,
                      activo: unidad.activo,
                    }))}
                  value={form.padre_id ?? ""}
                  includeInactive={Boolean(editingId)}
                  placeholder="Seleccioná la dependencia"
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      padre_id: value,
                    }))
                  }
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unidad-cargo">Cargo de jefe/a</Label>
              <Input
                id="unidad-cargo"
                className="w-full min-w-0"
                value={form.cargo_jefe}
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cargo_jefe: event.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner size="sm" />}
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!unitToDelete}
        onOpenChange={(open) => !open && !saving && setUnitToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar unidad</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la unidad “{unitToDelete?.nombre}”? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteUnit();
              }}
            >
              {saving && <Spinner size="sm" />}
              {saving ? "Eliminando…" : "Eliminar unidad"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!chiefToRemove}
        onOpenChange={(open) => !open && !saving && setChiefToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar jefatura</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quitar la jefatura de{" "}
              {`${chiefToRemove?.nombre ?? ""} ${chiefToRemove?.apellido ?? ""}`.trim() ||
                chiefToRemove?.email ||
                "esta persona"}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmRemoveChief();
              }}
            >
              {saving && <Spinner size="sm" />}
              {saving ? "Quitando…" : "Quitar jefatura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingChiefReplacement}
        onOpenChange={(open) => !open && !saving && setPendingChiefReplacement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemplazar jefatura actual</AlertDialogTitle>
            <AlertDialogDescription>
              La unidad ya tiene jefatura ({pendingChiefReplacement?.currentChiefName}). Si aprobás
              la solicitud, se reemplazará por la nueva persona.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                if (pendingChiefReplacement) {
                  void resolveRequest(pendingChiefReplacement.perfil, true, true);
                }
              }}
            >
              {saving && <Spinner size="sm" />}
              {saving ? "Aprobando…" : "Reemplazar y aprobar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
