BEGIN;

CREATE TEMP TABLE organigrama_seed (
  codigo TEXT PRIMARY KEY,
  padre_codigo TEXT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  cargo_jefe TEXT NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE organigrama_ids (
  codigo TEXT PRIMARY KEY,
  id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO organigrama_seed (codigo, padre_codigo, nombre, tipo, cargo_jefe) VALUES
  ('1', NULL, 'Ministerio de Producción', 'ministerio', 'Ministro/a de Producción'),
  ('1.1', '1', 'Secretaría Privada', 'secretaria', 'Secretario/a Privado/a'),
  ('1.2', '1', 'Secretaría de Agricultura y Ganadería', 'secretaria', 'Secretario/a de Agricultura y Ganadería'),
  ('1.2.1', '1.2', 'Dirección de Producción Vegetal', 'direccion', 'Director/a de Producción Vegetal'),
  ('1.2.2', '1.2', 'Dirección de Producción Animal', 'direccion', 'Director/a de Producción Animal'),
  ('1.2.2.1', '1.2.2', 'Departamento de Apicultura', 'departamento', 'Jefe/a del Departamento de Apicultura'),
  ('1.2.3', '1.2', 'Mercado Central', 'organismo', 'Administrador/a del Mercado Central'),
  ('1.3', '1', 'Secretaría de Desarrollo Foresto Industrial', 'secretaria', 'Secretario/a de Desarrollo Foresto Industrial'),
  ('1.3.1', '1.3', 'Dirección de Recursos Forestales', 'direccion', 'Director/a de Recursos Forestales'),
  ('1.3.1.1', '1.3.1', 'Departamento de Bosques Nativos', 'departamento', 'Jefe/a del Departamento de Bosques Nativos'),
  ('1.3.1.2', '1.3.1', 'Departamento de Bosques Cultivados', 'departamento', 'Jefe/a del Departamento de Bosques Cultivados'),
  ('1.3.1.3', '1.3.1', 'Departamento de Protección Forestal', 'departamento', 'Jefe/a del Departamento de Protección Forestal'),
  ('1.3.2', '1.3', 'Dirección de Asociaciones y Centros Tecnológicos Foresto Industrial', 'direccion', 'Director/a de Asociaciones y Centros Tecnológicos Foresto Industrial'),
  ('1.4', '1', 'Subsecretaría de Producción', 'subsecretaria', 'Subsecretario/a de Producción'),
  ('1.4.1', '1.4', 'Dirección de Cooperativas', 'direccion', 'Director/a de Cooperativas'),
  ('1.4.2', '1.4', 'Dirección de Economía Agraria', 'direccion', 'Director/a de Economía Agraria'),
  ('1.4.3', '1.4', 'Área de Recursos Hídricos Rurales', 'area', 'Responsable del Área de Recursos Hídricos Rurales'),
  ('1.4.4', '1.4', 'Área de Cartografía y Topografía Rural', 'area', 'Responsable del Área de Cartografía y Topografía Rural'),
  ('1.5', '1', 'Subsecretaría de Coordinación Administrativa', 'subsecretaria', 'Subsecretario/a de Coordinación Administrativa'),
  ('1.5.1', '1.5', 'Dirección de Administración', 'direccion', 'Director/a de Administración'),
  ('1.5.1.1', '1.5.1', 'Departamento Contable', 'departamento', 'Jefe/a del Departamento Contable'),
  ('1.5.1.2', '1.5.1', 'Departamento Tesorería', 'departamento', 'Jefe/a del Departamento Tesorería'),
  ('1.5.1.3', '1.5.1', 'Departamento de Rendición de Cuentas', 'departamento', 'Jefe/a del Departamento de Rendición de Cuentas'),
  ('1.5.1.4', '1.5.1', 'Departamento de Licitaciones y Compras', 'departamento', 'Jefe/a del Departamento de Licitaciones y Compras'),
  ('1.5.1.5', '1.5.1', 'Departamento de Bienes Patrimoniales', 'departamento', 'Jefe/a del Departamento de Bienes Patrimoniales'),
  ('1.5.1.6', '1.5.1', 'Departamento de Archivo', 'departamento', 'Jefe/a del Departamento de Archivo'),
  ('1.5.2', '1.5', 'Dirección de Recursos Humanos', 'direccion', 'Director/a de Recursos Humanos'),
  ('1.5.3', '1.5', 'Dirección de Asesoría Legal', 'direccion', 'Director/a de Asesoría Legal'),
  ('1.5.4', '1.5', 'Departamento de Despacho y Mesa de Entradas', 'departamento', 'Jefe/a del Departamento de Despacho y Mesa de Entradas'),
  ('1.5.5', '1.5', 'Departamento de Intendencia y Automotores', 'departamento', 'Jefe/a del Departamento de Intendencia y Automotores'),
  ('1.5.6', '1.5', 'Área de Prensa', 'area', 'Responsable del Área de Prensa'),
  ('1.5.7', '1.5', 'Área de Sistemas', 'area', 'Responsable del Área de Sistemas'),
  ('1.5.8', '1.5', 'Área de Regularización Dominial', 'area', 'Responsable del Área de Regularización Dominial'),
  ('1.6', '1', 'Instituto de Fomento Empresarial (IFE)', 'organismo', 'Presidente/a del IFE'),
  ('1.6.1', '1.6', 'Corrientes Exporta', 'programa', 'Coordinador/a de Corrientes Exporta');

DO $$
DECLARE
  elemento RECORD;
  padre_uuid UUID;
  unidad_uuid UUID;
  posicion INTEGER;
BEGIN
  FOR elemento IN
    SELECT *
    FROM organigrama_seed
    ORDER BY cardinality(string_to_array(codigo, '.')), codigo
  LOOP
    padre_uuid := NULL;
    IF elemento.padre_codigo IS NOT NULL THEN
      SELECT id INTO padre_uuid
      FROM organigrama_ids
      WHERE codigo = elemento.padre_codigo;
      IF padre_uuid IS NULL THEN
        RAISE EXCEPTION 'No se encontró el padre % de la unidad %', elemento.padre_codigo, elemento.codigo;
      END IF;
    END IF;

    posicion := split_part(
      elemento.codigo,
      '.',
      cardinality(string_to_array(elemento.codigo, '.'))
    )::INTEGER;

    INSERT INTO public.unidades (nombre, tipo, padre_id, cargo_jefe, orden)
    VALUES (elemento.nombre, elemento.tipo, padre_uuid, elemento.cargo_jefe, posicion)
    ON CONFLICT (
      (COALESCE(padre_id, '00000000-0000-0000-0000-000000000000'::UUID)),
      (lower(nombre))
    )
    DO UPDATE SET
      tipo = EXCLUDED.tipo,
      cargo_jefe = EXCLUDED.cargo_jefe,
      orden = EXCLUDED.orden
    RETURNING id INTO unidad_uuid;

    INSERT INTO organigrama_ids (codigo, id)
    VALUES (elemento.codigo, unidad_uuid)
    ON CONFLICT (codigo) DO UPDATE SET id = EXCLUDED.id;
  END LOOP;
END;
$$;

COMMIT;
