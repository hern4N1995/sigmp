import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserCircle, User as UserIcon, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil - SIG" },
      { name: "description", content: "Consulta los datos de tu cuenta en el portal de soporte." },
    ],
  }),
  component: MiPerfil,
});

type Profile = {
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  dni: string | null;
  unidad_id: string | null;
  es_jefe: boolean;
  solicitud_jefe: "pendiente" | "rechazada" | null;
  unidad_ruta: string | null;
  cargo_jefe: string | null;
};

function MiPerfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== passwordConfirmation) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(`No se pudo cambiar la contraseña: ${error.message}`);
        return;
      }

      setPassword("");
      setPasswordConfirmation("");
      toast.success("La contraseña se actualizó correctamente.");
    } catch (error) {
      console.error("Error inesperado al cambiar la contraseña:", error);
      toast.error("No se pudo cambiar la contraseña. Intentá nuevamente.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const [{ data, error }, { data: unidades, error: unidadesError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("nombre, apellido, email, dni, unidad_id, es_jefe, solicitud_jefe")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("unidades_arbol").select("id, ruta, cargo_jefe"),
      ]);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (unidadesError) {
        toast.error(`No se pudieron cargar las unidades: ${unidadesError.message}`);
        return;
      }
      if (!data) {
        setProfile(null);
        return;
      }
      const unidad = (unidades ?? []).find((option) => option.id === data.unidad_id);
      setProfile({
        ...data,
        unidad_ruta: unidad?.ruta ?? null,
        cargo_jefe: unidad?.cargo_jefe ?? null,
      });
    };
    loadProfile();
  }, [user]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
            <p className="text-sm text-muted-foreground">Información de tu cuenta.</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserIcon className="h-8 w-8" />
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {profile?.nombre ?? ""} {profile?.apellido ?? ""}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/completar-perfil" })}
            >
              Editar perfil
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={profile?.nombre ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Apellido</Label>
              <Input value={profile?.apellido ?? ""} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Correo electrónico</Label>
              <Input value={profile?.email ?? user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>DNI</Label>
              <Input value={profile?.dni ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Unidad</Label>
              <Input
                value={profile?.es_jefe ? (profile.cargo_jefe ?? "") : (profile?.unidad_ruta ?? "")}
                disabled
              />
            </div>
            {(profile?.es_jefe || profile?.solicitud_jefe) && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Solicitud de jefatura</Label>
                <Input
                  value={
                    profile.es_jefe
                      ? "Aprobada"
                      : profile.solicitud_jefe === "pendiente"
                        ? "Pendiente de aprobación"
                        : "Rechazada"
                  }
                  disabled
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="mt-6 p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
              <p className="text-sm text-muted-foreground">
                Elegí una contraseña nueva para tu cuenta.
              </p>
            </div>
          </div>
          <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-new-password">Nueva contraseña</Label>
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={updatingPassword}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-password-confirmation">Confirmar contraseña</Label>
              <Input
                id="profile-password-confirmation"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                disabled={updatingPassword}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={updatingPassword}>
                {updatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar contraseña
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
