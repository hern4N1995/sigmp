import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/recuperar-password")({
  head: () => ({ meta: [{ title: "Recuperar contraseña - Soporte Sistemas" }] }),
  ssr: false,
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md border-border bg-card/70 p-6 backdrop-blur">
        <Link to="/auth" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresá tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        {sent ? (
          <p className="mt-6 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
            Revisá tu correo. Si la dirección está registrada, recibirás un enlace para recuperar tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recovery-email">Correo electrónico</Label>
              <Input
                id="recovery-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@produccion.gob"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}