import { Spinner } from "@/components/ui/spinner";

export function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <img src="/escudo.png" alt="" className="size-16 object-contain" />
        <p className="text-2xl font-bold tracking-tight">SIG</p>
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">Ingresando…</p>
      </div>
    </main>
  );
}
