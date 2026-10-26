import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
export const Route = createFileRoute("/_authenticated/nueva-solicitud")({
  head: () => ({
    meta: [
      { title: "Nueva solicitud - SIG" },
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
  const [profile, setProfile] = useState<{
    nombre: string;
    apellido: string;
    unidad_id: string | null;
    unidad_nombre_snapshot: string;
    unidad_display: string;
    perfil_completo: boolean;
  } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [urgencia, setUrgencia] = useState<"urgente" | "normal">("normal");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p, error: profileError } = await supabase
        .from("profiles")
        .select("nombre, apellido, unidad_id, es_jefe, perfil_completo")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        toast.error(`No se pudo cargar tu perfil: ${profileError.message}`);
        return;
      }
      if (p && !p.perfil_completo) {
        navigate({ to: "/completar-perfil", replace: true });
        return;
      }
      const { data: unidades, error: unitsError } = await supabase
        .from("unidades_arbol")
        .select("id, nombre, ruta, cargo_jefe")
        .eq("id", p?.unidad_id ?? "");
      if (unitsError) {
        toast.error(`No se pudo cargar tu unidad: ${unitsError.message}`);
        return;
      }
      const unidad = unidades?.[0];
      setProfile({
        nombre: p?.nombre ?? "",
        apellido: p?.apellido ?? "",
        unidad_id: p?.unidad_id ?? null,
        unidad_nombre_snapshot: unidad?.nombre ?? "",
        unidad_display: p?.es_jefe ? (unidad?.cargo_jefe ?? "") : (unidad?.ruta ?? ""),
        perfil_completo: p?.perfil_completo ?? false,
      });
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
    if (!u.user) {
      setLoading(false);
      toast.error("No se pudo identificar tu sesión. Iniciá sesión nuevamente.");
      return;
    }
    if (!profile?.unidad_id || !profile.unidad_nombre_snapshot) {
      setLoading(false);
      toast.error(
        "Completá tu perfil y seleccioná una unidad activa antes de enviar una solicitud.",
      );
      navigate({ to: "/completar-perfil" });
      return;
    }
    const { error } = await supabase.from("solicitudes").insert({
      usuario_id: u.user.id,
      unidad_id: profile.unidad_id,
      unidad_nombre_snapshot: profile.unidad_nombre_snapshot,
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
        <PageHeader
          title="Nueva solicitud"
          description="Describí el problema y el equipo de Sistemas lo tomará."
          icon={PlusCircle}
        />

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={profile?.nombre ?? ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input value={profile?.apellido ?? ""} disabled />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Unidad</Label>
                {/* Read-only box instead of an input so long unit paths wrap instead of being cut off. */}
                <div
                  aria-disabled="true"
                  className="flex min-h-10 w-full cursor-not-allowed items-center rounded-md border border-input bg-transparent px-3 py-2 text-base opacity-50 shadow-sm break-words md:text-sm"
                >
                  {profile?.unidad_display ?? ""}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo del pedido</Label>
              <Input
                id="motivo"
                className="break-all"
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
                className="break-words whitespace-pre-wrap"
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
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${urgencia === "normal" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <RadioGroupItem value="normal" />
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Normal</span>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${urgencia === "urgente" ? "border-destructive bg-destructive/10" : "border-border"}`}
                >
                  <RadioGroupItem value="urgente" />
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Urgente</span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={loading || !profile}>
              {loading && <Spinner size="sm" />}
              {loading ? "Enviando solicitud…" : "Enviar solicitud"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
