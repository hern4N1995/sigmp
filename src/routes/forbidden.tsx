import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/forbidden")({
  head: () => ({
    meta: [
      { title: "403 - Acceso denegado | Soporte Sistemas" },
      { name: "description", content: "No tenés permisos para acceder a esta sección." },
    ],
  }),
  ssr: false,
  component: Forbidden,
});

function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-5xl font-bold text-foreground">403</h1>
        <h2 className="mt-3 text-lg font-semibold">Acceso denegado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No tenés permisos para ver esta sección.
        </p>
        <div className="mt-6">
          <Link
            to="/perfil"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ir a mi perfil
          </Link>
        </div>
      </div>
    </div>
  );
}
