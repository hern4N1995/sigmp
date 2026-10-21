import { Spinner } from "@/components/ui/spinner";

export function RouterPending() {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/60 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-40 flex-col items-center gap-3 rounded-xl border border-border bg-card/95 px-7 py-6 text-card-foreground shadow-lg">
        <p className="text-2xl font-bold tracking-tight">SIG</p>
        <Spinner size="lg" className="loading-spinner text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Cargando…</p>
      </div>
    </div>
  );
}
