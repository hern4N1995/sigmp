import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Users, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Role = "administrador" | "empleado";

type Row = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  area: string | null;
  created_at: string;
  role: Role;
};

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Administración | Soporte Sistemas" },
      { name: "description", content: "Administración de usuarios del portal de soporte." },
    ],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", apellido: "", area: "", role: "empleado" as Role });

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, nombre, apellido, email, area, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesMap = new Map<string, Role>();
    (roles ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role as Role));
    const merged: Row[] = (profiles ?? []).map((p: any) => ({
      ...p,
      role: rolesMap.get(p.id) ?? "empleado",
    }));
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({ nombre: r.nombre ?? "", apellido: r.apellido ?? "", area: r.area ?? "", role: r.role });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ nombre: form.nombre, apellido: form.apellido, area: form.area })
      .eq("id", editing.id);
    if (pErr) {
      toast.error(pErr.message);
      setSaving(false);
      return;
    }
    if (form.role !== editing.role) {
      await supabase.from("user_roles").delete().eq("user_id", editing.id);
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: editing.id, role: form.role });
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

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Administrá los usuarios y roles del sistema.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Sin usuarios.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.nombre ?? "—"}</td>
                    <td className="px-4 py-3">{r.apellido ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-3">{r.area ?? "—"}</td>
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
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Área</Label>
              <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
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
    </AppShell>
  );
}
