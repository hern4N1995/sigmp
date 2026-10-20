ALTER TABLE public.areas
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS areas_parent_id_idx ON public.areas(parent_id);

WITH relaciones(nombre_hijo, nombre_padre) AS (
  VALUES
    ('Dirección de Producción Vegetal', 'Secretaría de Agricultura y Ganadería'),
    ('Dirección de Producción Animal', 'Secretaría de Agricultura y Ganadería'),
    ('Mercado Central', 'Secretaría de Agricultura y Ganadería'),
    ('Dirección de Recursos Forestales', 'Secretaría de Desarrollo Foresto Industrial'),
    ('Departamento de Bosques Nativos', 'Dirección de Recursos Forestales'),
    ('Departamento de Bosques Cultivados', 'Dirección de Recursos Forestales'),
    ('Departamento de Protección Forestal', 'Dirección de Recursos Forestales'),
    ('Dirección de Asociaciones y Centros Tecnológicos Foresto Industrial', 'Secretaría de Desarrollo Foresto Industrial'),
    ('Dirección de Cooperativas', 'Subsecretaría de Producción'),
    ('Departamento de Fiscalización y Registro', 'Dirección de Cooperativas'),
    ('Departamento de Promoción y Capacitación', 'Dirección de Cooperativas'),
    ('Dirección de Economía Agraria', 'Subsecretaría de Producción'),
    ('Departamento de Emergencia Agropecuaria', 'Dirección de Economía Agraria'),
    ('Departamento de Pronósticos y Estimaciones', 'Dirección de Economía Agraria'),
    ('Área de Recursos Hídricos Rurales', 'Subsecretaría de Producción'),
    ('Área de Cartografía y Topografía Rural', 'Subsecretaría de Producción'),
    ('Dirección de Administración', 'Subsecretaría de Coordinación Administrativa'),
    ('Departamento Contable', 'Dirección de Administración'),
    ('Departamento Tesorería', 'Dirección de Administración'),
    ('Departamento de Rendición de Cuentas', 'Dirección de Administración'),
    ('Departamento de Licitaciones y Compras', 'Dirección de Administración'),
    ('Departamento de Bienes Patrimoniales', 'Dirección de Administración'),
    ('Departamento de Archivo', 'Dirección de Administración'),
    ('Dirección de Recursos Humanos', 'Subsecretaría de Coordinación Administrativa'),
    ('Dirección de Asesoría Legal', 'Subsecretaría de Coordinación Administrativa'),
    ('Departamento de Sumarios', 'Dirección de Asesoría Legal'),
    ('Departamento Jurídico', 'Dirección de Asesoría Legal'),
    ('Departamento de Despacho y Mesa de Entradas', 'Subsecretaría de Coordinación Administrativa'),
    ('Departamento de Intendencia y Automotores', 'Subsecretaría de Coordinación Administrativa'),
    ('Área de Prensa', 'Subsecretaría de Coordinación Administrativa'),
    ('Área de Sistemas', 'Subsecretaría de Coordinación Administrativa'),
    ('Área de Regularización Dominial', 'Subsecretaría de Coordinación Administrativa')
)
UPDATE public.areas AS hijo
SET parent_id = padre.id
FROM relaciones
JOIN public.areas AS padre ON padre.nombre_completo = relaciones.nombre_padre
WHERE hijo.nombre_completo = relaciones.nombre_hijo;

WITH coincidencias AS (
  SELECT
    p.id AS profile_id,
    MIN(a.id::TEXT)::UUID AS area_id
  FROM public.profiles AS p
  JOIN public.areas AS a
    ON TRIM(p.area) = a.nombre_corto
    OR TRIM(p.area) = a.nombre_completo
  WHERE p.area_id IS NULL
    AND p.area IS NOT NULL
  GROUP BY p.id
  HAVING COUNT(DISTINCT a.id) = 1
)
UPDATE public.profiles AS p
SET area_id = coincidencias.area_id
FROM coincidencias
WHERE p.id = coincidencias.profile_id;
