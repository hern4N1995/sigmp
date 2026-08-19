import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, PlusCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/nueva-solicitud")({
  head: () => ({
    meta: [
      { title: "Nueva solicitud — Soporte Sistemas" },
      { name: "description", content: "Registrá un nuevo pedido al Área de Sistemas." },
    ],
  }),
  component: NuevaSolicitud,
});

const schema = z.object({
  motivo: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().min(5).max(1000),
  urgencia: z.enum(["urgente", "normal"]),
});

function NuevaSolicitud() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ nombre: string; apellido: string; area: string; perfil_completo: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState<"urgente" | "normal">("normal");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("nombre, apellido, area, area_id, perfil_completo")
        .eq("id", data.user.id)
        .maybeSingle();
      if (p && !p.perfil_completo) {
        navigate({ to: "/completar-perfil", replace: true });
        return;
      }
      const { data: area } = p?.area_id
        ? await supabase.from("areas").select("nombre_corto").eq("id", p.area_id).maybeSingle()
        : { data: null };
      setProfile({ ...p, area: area?.nombre_corto ?? p?.area ?? "" } as any);
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ motivo, descripcion, urgencia });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("solicitudes").insert({
      usuario_id: u.user.id,
      ...parsed.data,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Su solicitud fue enviada correctamente.");
    navigate({ to: "/mis-solicitudes" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <PlusCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nueva solicitud</h1>
            <p className="text-sm text-muted-foreground">Describí el problema y el equipo de Sistemas lo tomará.</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={profile?.nombre ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input value={profile?.apellido ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Input value={profile?.area ?? ""} disabled />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo del pedido</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: No enciende la computadora"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Descripción del problema</Label>
              <Textarea
                id="desc"
                rows={5}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Detallá lo que sucede y cuándo comenzó..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Nivel de urgencia</Label>
              <RadioGroup
                value={urgencia}
                onValueChange={(v) => setUrgencia(v as "urgente" | "normal")}
                className="grid grid-cols-2 gap-3"
              >
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${urgencia === "normal" ? "border-primary bg-primary/10" : "border-border"}`}>
                  <RadioGroupItem value="normal" />
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Normal</span>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${urgencia === "urgente" ? "border-destructive bg-destructive/10" : "border-border"}`}>
                  <RadioGroupItem value="urgente" />
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Urgente</span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={loading || !profile}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar solicitud
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
