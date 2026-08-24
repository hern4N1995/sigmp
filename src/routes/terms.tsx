import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Términos y condiciones</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Uso de la plataforma</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            El uso del portal de soporte interno implica el cumplimiento de las políticas institucionales,
            la normativa vigente en materia de seguridad informática y la correcta utilización de la
            información gestionada en la plataforma.
          </p>
          <p>
            Los usuarios son responsables del contenido ingresado a las solicitudes, así como de la
            exactitud y veracidad de la información remitida.
          </p>
          <p>
            El Ministerio de Producción puede modificar, actualizar o mejorar los servicios del portal
            para garantizar su correcto funcionamiento y la continuidad de los procesos institucionales.
          </p>
        </div>
      </div>
    </div>
  );
}
