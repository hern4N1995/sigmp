import { Facebook, Instagram, Twitter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function Footer({ fixed = true }: { fixed?: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`app-shell-footer ${fixed ? "fixed inset-x-0 bottom-0 z-40" : "relative"} w-full border-t border-border bg-card/85 shadow-[0_-10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm`}>
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
        <div className="grid items-center gap-3 sm:gap-5 md:grid-cols-[1fr_auto_1fr]">
          <div className="app-shell-footer-links flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:gap-5 md:justify-start">
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className="app-shell-footer-link transition-colors">
                  Privacidad
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Privacidad y tratamiento de datos</DialogTitle>
                  <DialogDescription>
                    Información sobre el uso de los datos dentro del Sistema Interno de Gestión.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    El Ministerio de Producción de Corrientes y el Área de Sistemas gestionan la
                    información necesaria para atender solicitudes internas y mantener la continuidad
                    operativa de los servicios del organismo.
                  </p>
                  <p>
                    Los datos personales se utilizan exclusivamente para fines institucionales,
                    administración de usuarios, seguimiento de requerimientos y mejora de los procesos
                    digitales.
                  </p>
                  <p>
                    El acceso a la plataforma está restringido a personal autorizado y se aplican
                    medidas de seguridad razonables para proteger la información frente a accesos no
                    autorizados.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className="app-shell-footer-link transition-colors">
                  Términos
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Uso de la plataforma</DialogTitle>
                  <DialogDescription>
                    Términos y condiciones para utilizar el Sistema Interno de Gestión.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    El uso del portal de soporte interno implica el cumplimiento de las políticas
                    institucionales, la normativa vigente en materia de seguridad informática y la
                    correcta utilización de la información gestionada en la plataforma.
                  </p>
                  <p>
                    Los usuarios son responsables del contenido ingresado a las solicitudes, así como
                    de la exactitud y veracidad de la información remitida.
                  </p>
                  <p>
                    El Ministerio de Producción puede modificar, actualizar o mejorar los servicios del
                    portal para garantizar su correcto funcionamiento y la continuidad de los procesos
                    institucionales.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="app-shell-footer-copy text-center text-xs text-muted-foreground sm:text-sm">
            <p className="font-medium text-foreground">
              © {currentYear} Ministerio de Producción de Corrientes
            </p>
            <p className="text-xs">Todos los derechos reservados</p>
            <p className="mt-1 font-medium text-foreground sm:mt-2">Área de Sistemas</p>
            <p>
              Desarrollo técnico: {" "}
              <a
                href="https://www.linkedin.com/in/hernanalegre/"
                target="_blank"
                rel="noopener noreferrer"
                className="app-shell-footer-link font-semibold transition-colors"
              >
                Hernán Alegre
              </a>
              {" & "}
              <a
                href="https://www.linkedin.com/in/c-ivan-nunez/"
                target="_blank"
                rel="noopener noreferrer"
                className="app-shell-footer-link font-semibold transition-colors"
              >
                Iván Nuñez
              </a>
            </p>
            <p>
              Dirección del proyecto: {" "}
              <a
                href="https://www.linkedin.com/in/ester-kroslak/"
                target="_blank"
                rel="noopener noreferrer"
                className="app-shell-footer-link font-semibold transition-colors"
              >
                Lic. Ester Kroslak
              </a>
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 md:justify-end">
            <a
              href="https://www.facebook.com/ProduccionCorrientes"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="app-shell-social-link inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href="https://www.x.com/mp_ctes"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter"
              className="app-shell-social-link inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/ministerio_produccion"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="app-shell-social-link inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
