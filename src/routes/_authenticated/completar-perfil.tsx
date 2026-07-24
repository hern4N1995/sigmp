import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/completar-perfil")({
  head: () => ({
    meta: [
      { title: "Completar perfil — Soporte Sistemas" },
      { name: "description", content: "Completá tus datos para acceder al sistema." },
    ],
  }),
  component: Perfil,
});

const schema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(60),
  apellido: z.string().trim().min(2, "Apellido requerido").max(60),
  dni: z.string().trim().regex(/^\d{6,10}$/, "DNI inválido"),
  area: z.string().trim().min(2, "Área requerida").max(80),
});

function Perfil() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: "", apellido: "", dni: "", area: "" });
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (p) {
        setForm({
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          dni: p.dni ?? "",
          area: p.area ?? "",
        });
      }
      setInitial(false);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ ...parsed.data, perfil_completo: true })
      .eq("id", u.user.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil actualizado");
    navigate({ to: "/nueva-solicitud" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Completá tu perfil</h1>
            <p className="text-sm text-muted-foreground">Necesitamos estos datos para procesar tus solicitudes.</p>
          </div>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} disabled={initial} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} disabled={initial} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dni">DNI</Label>
              <Input id="dni" inputMode="numeric" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} disabled={initial} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area">Área o dependencia</Label>
              <Input id="area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} disabled={initial} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full sm:w-auto" disabled={loading || initial}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar y continuar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
