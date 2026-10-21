import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { UnidadSelector } from "@/components/unidad-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";
import type { UnidadOption } from "@/components/unidad-selector";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/_authenticated/completar-perfil")({
  head: () => ({
    meta: [
      { title: "Completar perfil - SIG" },
      { name: "description", content: "Completá tus datos para acceder al sistema." },
    ],
  }),
  component: Perfil,
});

const schema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "Nombre requerido")
    .max(60)
    .regex(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u, "El nombre solo puede contener letras"),
  apellido: z
    .string()
    .trim()
    .min(2, "Apellido requerido")
    .max(60)
    .regex(
      /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u,
      "El apellido solo puede contener letras",
    ),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, "El DNI debe tener 7 u 8 dígitos"),
  unidadId: z.string().uuid("Elegí una unidad."),
  soyJefe: z.boolean(),
});

function Perfil() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    unidadId: "",
    soyJefe: false,
  });
  const [unidades, setUnidades] = useState<UnidadOption[]>([]);
  const [solicitudJefe, setSolicitudJefe] = useState<"pendiente" | "rechazada" | null>(null);
  const [esJefe, setEsJefe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const [{ data: p, error: profileError }, { data: unitOptions, error: unitsError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("nombre, apellido, dni, perfil_completo, unidad_id, es_jefe, solicitud_jefe")
            .eq("id", data.user.id)
            .maybeSingle(),
          supabase
            .from("unidades_arbol")
            .select("id, ruta, activo")
            .eq("activo", true)
            .order("ruta"),
        ]);
      if (profileError) toast.error(`No se pudo cargar tu perfil: ${profileError.message}`);
      if (unitsError) toast.error(`No se pudieron cargar las unidades: ${unitsError.message}`);
      setUnidades((unitOptions ?? []) as UnidadOption[]);
      if (p) {
        setProfileComplete(p.perfil_completo);
        setSolicitudJefe(p.solicitud_jefe);
        setEsJefe(p.es_jefe);
        setForm({
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          dni: p.dni ?? "",
          unidadId: p.unidad_id ?? "",
          soyJefe: p.solicitud_jefe === "pendiente",
        });
      }
      setInitial(false);
    });
  }, []);

  const updateName = (field: "nombre" | "apellido", value: string) => {
    setForm((current) => ({ ...current, [field]: value.replace(/\p{N}/gu, "") }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
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
    const { error } = await supabase
      .from("profiles")
      .update({
        nombre: parsed.data.nombre,
        apellido: parsed.data.apellido,
        dni: parsed.data.dni,
        unidad_id: parsed.data.unidadId,
        ...(parsed.data.soyJefe && !esJefe ? { solicitud_jefe: "pendiente" as const } : {}),
        perfil_completo: true,
      })
      .eq("id", u.user.id);
    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Ese DNI ya está registrado por otro usuario.");
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Perfil actualizado");
    if (parsed.data.soyJefe && !esJefe) setSolicitudJefe("pendiente");
    navigate({ to: profileComplete ? "/perfil" : "/nueva-solicitud" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={profileComplete ? "Editá tu perfil" : "Completá tu perfil"}
          description="Necesitamos estos datos para procesar tus solicitudes."
          icon={UserCircle}
        />
        <Card className="p-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => updateName("nombre", e.target.value)}
                maxLength={60}
                autoComplete="given-name"
                disabled={initial}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                value={form.apellido}
                onChange={(e) => updateName("apellido", e.target.value)}
                maxLength={60}
                autoComplete="family-name"
                disabled={initial}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                inputMode="numeric"
                maxLength={8}
                value={form.dni}
                onChange={(e) =>
                  setForm({ ...form, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })
                }
                disabled={initial}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <UnidadSelector
                unidades={unidades}
                value={form.unidadId}
                onValueChange={(unidadId) => setForm((current) => ({ ...current, unidadId }))}
                disabled={initial || esJefe}
              />
              {esJefe && (
                <p className="text-xs text-muted-foreground">
                  Para cambiar tu unidad, contactá a un administrador mientras tu jefatura esté
                  aprobada.
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              {esJefe ? (
                <p className="text-sm text-primary">Tu jefatura está aprobada.</p>
              ) : (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="solicitar-jefatura"
                    checked={form.soyJefe || solicitudJefe === "pendiente"}
                    disabled={initial || solicitudJefe === "pendiente"}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, soyJefe: checked === true }))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor="solicitar-jefatura">Soy jefe/a de esta unidad</Label>
                    {solicitudJefe === "pendiente" && (
                      <p className="text-xs text-muted-foreground">
                        Solicitud pendiente de aprobación.
                      </p>
                    )}
                    {solicitudJefe === "rechazada" && (
                      <p className="text-xs text-destructive">
                        La solicitud fue rechazada. Podés volver a solicitarla.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full sm:w-auto" disabled={loading || initial}>
                {loading && <Spinner size="sm" />}
                {loading
                  ? "Guardando…"
                  : profileComplete
                    ? "Guardar cambios"
                    : "Guardar y continuar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
