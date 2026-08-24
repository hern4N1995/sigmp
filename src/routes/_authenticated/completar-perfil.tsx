import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, UserCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/completar-perfil")({
  head: () => ({
    meta: [
      { title: "Completar perfil - Soporte Sistemas" },
      { name: "description", content: "Completá tus datos para acceder al sistema." },
    ],
  }),
  component: Perfil,
});

const schema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido").max(60),
  apellido: z.string().trim().min(2, "Apellido requerido").max(60),
  dni: z.string().trim().regex(/^\d{6,10}$/, "DNI inválido"),
  areaId: z.string().uuid("Área requerida"),
});

type Area = { id: string; nombre_completo: string; nombre_corto: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Perfil() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: "", apellido: "", dni: "", areaId: "" });
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaOpen, setAreaOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const [{ data: p }, { data: areaOptions, error: areasError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle(),
        supabase.from("areas").select("id, nombre_completo, nombre_corto").order("nombre_corto"),
      ]);
      if (areasError) toast.error(areasError.message);
      setAreas(areaOptions ?? []);
      if (p) {
        setForm({
          nombre: p.nombre ?? "",
          apellido: p.apellido ?? "",
          dni: p.dni ?? "",
          areaId: p.area_id ?? areaOptions?.find((area) => area.nombre_completo === p.area || area.nombre_corto === p.area)?.id ?? "",
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
      .update({ nombre: parsed.data.nombre, apellido: parsed.data.apellido, dni: parsed.data.dni, area_id: parsed.data.areaId, perfil_completo: true })
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
              <Popover open={areaOpen} onOpenChange={setAreaOpen}>
                <PopoverTrigger asChild>
                  <Button id="area" type="button" variant="outline" role="combobox" aria-expanded={areaOpen} disabled={initial} className="w-full justify-between font-normal">
                    {areas.find((area) => area.id === form.areaId)?.nombre_corto ?? "Seleccioná un área"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command filter={(value, search) => {
                    const area = areas.find((option) => option.id === value);
                    return area && normalize(`${area.nombre_corto} ${area.nombre_completo}`).includes(normalize(search)) ? 1 : 0;
                  }}>
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron áreas.</CommandEmpty>
                      {areas.map((area) => (
                        <CommandItem key={area.id} value={area.id} onSelect={() => {
                          setForm({ ...form, areaId: area.id });
                          setAreaOpen(false);
                        }}>
                          <Check className={form.areaId === area.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                          {area.nombre_corto}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
