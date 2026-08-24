import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Footer } from "@/components/footer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar - Soporte Sistemas | Ministerio de Producción" },
      { name: "description", content: "Portal interno para registrar y gestionar solicitudes de soporte técnico." },
      { property: "og:title", content: "Portal de Soporte Técnico" },
      { property: "og:description", content: "Ministerio de Producción - Área de Sistemas" },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión con Google");
      setLoading(false);
      return;
    }
    navigate({ to: "/", replace: true });
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="app-shell-header flex h-14 items-center border-b border-border bg-background/80 px-4 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur lg:h-16 lg:px-6">
        <div className="flex w-full items-center gap-3">
          <div className="app-shell-favicon flex h-10 w-10 items-center justify-center rounded-lg bg-primary p-1 shadow-sm shadow-primary/20 lg:h-11 lg:w-11">
            <img
              src="/favicon.png"
              alt="Ministerio de Producción"
              className="h-full w-full rounded-md object-cover"
            />
          </div>
          <div className="leading-tight">
            <div className="text-xs font-bold text-foreground sm:text-sm">Área de Sistemas</div>
            <div className="text-[10px] text-muted-foreground sm:text-[11px]">Ministerio de Producción</div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-start">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-start px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] lg:gap-10 lg:py-10 lg:px-8">
        <div className="mb-8 w-full max-w-2xl text-center lg:mb-0 lg:text-left">
          
          <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
            Sistema Integral de Gestión del Ministerio de Producción
          </h1>
          <p className="mt-4 text-lg font-medium text-primary">Seguimiento en tiempo real</p>

          <section className="mt-8 border-t border-border/70 pt-6">
            <h2 className="text-center text-xl font-semibold text-primary lg:text-left">
              ¿Qué es el Sistema Integral de Gestión?
            </h2>
            <div className="mt-4 space-y-3 text-left text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                Es una página web diseñada para optimizar y centralizar procesos administrativos y
                operativos. Su objetivo principal es simplificar la organización, seguimiento y
                evaluación de tareas y recursos. Este sistema incluye funcionalidades clave como:
              </p>
              <p>
                <strong className="font-semibold text-foreground">Gestión de turnos:</strong> permitirá
                a los usuarios solicitar turnos para la asistencia en la resolución de problemas,
                agilizando el proceso y reduciendo tiempos de espera.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Sistema de calificaciones:</strong> ofrece
                un apartado donde los usuarios pueden evaluar la calidad de la asistencia recibida,
                proporcionando datos valiosos para mejorar el servicio.
              </p>
              <p>
                Este sistema no solo mejora la experiencia del usuario, sino que también ayuda a
                recopilar información útil para la toma de decisiones estratégicas.
              </p>
            </div>
          </section>
        </div>

        <Card className="w-full max-w-md border-border bg-card/70 p-6 backdrop-blur">
          <div className="mb-5 flex gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Registrarse
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </Button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs uppercase text-muted-foreground">o</span>
            </div>
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@produccion.gob"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
            </Button>
          </form>
        </Card>
        </div>
      </main>
      <Footer fixed={false} />
    </div>
  );
}
