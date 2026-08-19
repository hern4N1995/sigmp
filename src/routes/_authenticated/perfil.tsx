import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { UserCircle, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — Soporte Sistemas" },
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
  area: string | null;
  area_id: string | null;
  areas: { nombre_corto: string } | null;
};

function MiPerfil() {
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nombre, apellido, email, dni, area, area_id, areas(nombre_corto)")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
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
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <UserIcon className="h-8 w-8" />
            </div>
            <div>
              <div className="text-lg font-semibold">
                {profile?.nombre ?? ""} {profile?.apellido ?? ""}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isAdmin ? "Administrador" : "Empleado"}
              </div>
            </div>
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
              <Label>Área</Label>
              <Input value={profile?.areas?.nombre_corto ?? profile?.area ?? ""} disabled />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Rol</Label>
              <Input value={isAdmin ? "Administrador" : "Empleado"} disabled />
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
