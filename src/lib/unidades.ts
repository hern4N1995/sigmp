export const UNIDAD_TIPOS = [
  "ministerio",
  "secretaria",
  "subsecretaria",
  "direccion",
  "subdireccion",
  "departamento",
  "area",
  "organismo",
  "programa",
  "centro",
] as const;

export type UnidadTipo = (typeof UNIDAD_TIPOS)[number];

export type UnidadNode = {
  id: string;
  padre_id: string | null;
  nombre: string;
  tipo: UnidadTipo;
  cargo_jefe: string;
  activo: boolean;
  orden: number;
  nivel: number;
  codigo: string;
  ruta: string;
};

export const unidadTipoLabels: Record<UnidadTipo, string> = {
  ministerio: "Ministerio",
  secretaria: "Secretaría",
  subsecretaria: "Subsecretaría",
  direccion: "Dirección",
  subdireccion: "Subdirección",
  departamento: "Departamento",
  area: "Área",
  organismo: "Organismo",
  programa: "Programa",
  centro: "Centro",
};

export function getUnidadDescendantIds(unidadId: string, unidades: UnidadNode[]) {
  const descendants = new Set([unidadId]);
  const pending = [unidadId];

  while (pending.length) {
    const padreId = pending.pop();
    for (const unidad of unidades) {
      if (unidad.padre_id === padreId && !descendants.has(unidad.id)) {
        descendants.add(unidad.id);
        pending.push(unidad.id);
      }
    }
  }

  return descendants;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
