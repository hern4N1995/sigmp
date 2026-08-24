import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Política de privacidad</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Privacidad y tratamiento de datos</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            El Ministerio de Producción de Corrientes y el Área de Sistemas gestionan la información
            necesaria para atender solicitudes internas y mantener la continuidad operativa de los
            servicios del organismo.
          </p>
          <p>
            Los datos personales se usan exclusivamente para fines institucionales, administración de
            usuarios, seguimiento de requerimientos y mejora de los procesos digitales.
          </p>
          <p>
            El acceso a la plataforma está restringido a personal autorizado y se aplican medidas de
            seguridad razonables para proteger la información frente a accesos no autorizados.
          </p>
        </div>
      </div>
    </div>
  );
}
