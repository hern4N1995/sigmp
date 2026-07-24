import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CircleDot, CircleCheck } from "lucide-react";

export function UrgenciaBadge({ value }: { value: "urgente" | "normal" }) {
  if (value === "urgente")
    return (
      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
        <AlertTriangle className="mr-1 h-3 w-3" /> Urgente
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-border text-muted-foreground">
      Normal
    </Badge>
  );
}

export function EstadoBadge({ value }: { value: "en_espera" | "en_proceso" | "finalizado" }) {
  if (value === "en_espera")
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400">
        <Clock className="mr-1 h-3 w-3" /> En espera
      </Badge>
    );
  if (value === "en_proceso")
    return (
      <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-400">
        <CircleDot className="mr-1 h-3 w-3" /> En proceso
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-primary/40 bg-primary/15 text-primary">
      <CircleCheck className="mr-1 h-3 w-3" /> Finalizado
    </Badge>
  );
}
