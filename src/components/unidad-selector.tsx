import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeText } from "@/lib/unidades";

export type UnidadOption = {
  id: string;
  ruta: string;
  activo: boolean;
};

export function UnidadSelector({
  unidades,
  value,
  onValueChange,
  disabled = false,
  includeInactive = false,
  placeholder = "Seleccioná una unidad",
}: {
  unidades: UnidadOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  includeInactive?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = unidades.find((unidad) => unidad.id === value);
  const selectedName = selected?.ruta.split(" > ").at(-1);

  useEffect(() => {
    const dialog = triggerRef.current?.closest('[role="dialog"]');
    setPortalContainer(dialog instanceof HTMLElement ? dialog : null);
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-w-0 justify-between font-normal aria-expanded:ring-2 aria-expanded:ring-ring aria-expanded:ring-offset-2"
        >
          <span className="truncate">{selectedName ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalContainer={portalContainer}
        collisionPadding={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg p-0"
        align="start"
      >
        <Command
          className="min-h-0"
          filter={(optionValue, search) => {
            const unidad = unidades.find((candidate) => candidate.id === optionValue);
            return unidad && normalizeText(unidad.ruta).includes(normalizeText(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar unidad o dependencia..." />
          <CommandList>
            <CommandEmpty>No se encontraron unidades.</CommandEmpty>
            {unidades
              .filter((unidad) => includeInactive || unidad.activo)
              .map((unidad) => {
                const partesRuta = unidad.ruta.split(" > ");
                const nombre = partesRuta[partesRuta.length - 1] ?? unidad.ruta;
                const padre = partesRuta.length > 1 ? partesRuta[partesRuta.length - 2] : null;
                const profundidad = partesRuta.length - 1;
                const sangria = Math.min(profundidad, 5) * 12;

                return (
                  <CommandItem
                    key={unidad.id}
                    value={unidad.id}
                    className="items-start py-2"
                    title={unidad.ruta}
                    aria-label={unidad.ruta}
                    onSelect={() => {
                      onValueChange(unidad.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={
                        value === unidad.id
                          ? "mr-2 mt-0.5 h-4 w-4 shrink-0 opacity-100"
                          : "mr-2 mt-0.5 h-4 w-4 shrink-0 opacity-0"
                      }
                    />
                    <span
                      className="flex min-w-0 flex-1 flex-col"
                      style={{ paddingLeft: `${sangria}px` }}
                    >
                      <span className="whitespace-normal break-words">{nombre}</span>
                      {padre && (
                        <span className="whitespace-normal break-words text-xs text-muted-foreground">
                          Depende de: {padre}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
