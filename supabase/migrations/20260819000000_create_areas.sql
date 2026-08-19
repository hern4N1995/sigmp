CREATE TABLE public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL UNIQUE,
  nombre_corto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view areas" ON public.areas
FOR SELECT TO authenticated
USING (true);

GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;

INSERT INTO public.areas (nombre_completo, nombre_corto) VALUES
  ('Secretaría de Agricultura y Ganadería', 'Agricultura y Ganadería'),
  ('Dirección de Producción Vegetal', 'Producción Vegetal'),
  ('Subdirección de Sanidad Vegetal', 'Sanidad Vegetal'),
  ('Departamento de Fiscalización y Control Vegetal', 'Fiscalización y Control Vegetal'),
  ('Departamento de Horticultura', 'Horticultura'),
  ('Departamento de Fruticultura', 'Fruticultura'),
  ('Departamento de Yerba, Té y Otros Cultivos', 'Yerba, Té y Otros Cultivos'),
  ('Departamento de Calidad y Buenas Prácticas Agropecuarias', 'Calidad y Buenas Prácticas Agropecuarias'),
  ('Dirección de Producción Animal', 'Producción Animal'),
  ('Subdirección de Sanidad Animal', 'Sanidad Animal'),
  ('Departamento de Fiscalización y Control Animal', 'Fiscalización y Control Animal'),
  ('Departamento de Promoción Ganadera', 'Promoción Ganadera'),
  ('Departamento de Desarrollo Ovino', 'Desarrollo Ovino'),
  ('Departamento de Porcino, Aves y Otros', 'Porcino, Aves y Otros'),
  ('Departamento de Apicultura', 'Apicultura'),
  ('Departamento de Piscicultura', 'Piscicultura'),
  ('Mercado Central', 'Mercado Central'),
  ('Secretaría de Desarrollo Foresto Industrial', 'Desarrollo Foresto Industrial'),
  ('Dirección de Recursos Forestales', 'Recursos Forestales'),
  ('Departamento de Bosques Nativos', 'Bosques Nativos'),
  ('Departamento de Bosques Cultivados', 'Bosques Cultivados'),
  ('Departamento de Protección Forestal', 'Protección Forestal'),
  ('Dirección de Asociaciones y Centros Tecnológicos Foresto Industrial', 'Asociaciones y Centros Tecnológicos Foresto Industrial'),
  ('Subsecretaría de Producción', 'Producción'),
  ('Dirección de Cooperativas', 'Cooperativas'),
  ('Departamento de Fiscalización y Registro', 'Fiscalización y Registro'),
  ('Departamento de Promoción y Capacitación', 'Promoción y Capacitación'),
  ('Dirección de Economía Agraria', 'Economía Agraria'),
  ('Departamento de Emergencia Agropecuaria', 'Emergencia Agropecuaria'),
  ('Departamento de Pronósticos y Estimaciones', 'Pronósticos y Estimaciones'),
  ('Dirección de Infraestructura Rural', 'Infraestructura Rural'),
  ('Delegaciones del Ministerio en el Interior', 'Delegaciones del Interior'),
  ('Área de Recursos Hídricos Rurales', 'Recursos Hídricos Rurales'),
  ('Área de Cartografía y Topografía Rural', 'Cartografía y Topografía Rural'),
  ('Subsecretaría de Coordinación Administrativa', 'Coordinación Administrativa'),
  ('Dirección de Administración', 'Administración'),
  ('Departamento Contable', 'Contable'),
  ('Departamento Tesorería', 'Tesorería'),
  ('Departamento de Rendición de Cuentas', 'Rendición de Cuentas'),
  ('Departamento de Licitaciones y Compras', 'Licitaciones y Compras'),
  ('Departamento de Bienes Patrimoniales', 'Bienes Patrimoniales'),
  ('Departamento de Archivo', 'Archivo'),
  ('Dirección de Recursos Humanos', 'Recursos Humanos'),
  ('Dirección de Asesoría Legal', 'Asesoría Legal'),
  ('Departamento de Sumarios', 'Sumarios'),
  ('Departamento Jurídico', 'Jurídico'),
  ('Departamento de Despacho y Mesa de Entradas', 'Despacho y Mesa de Entradas'),
  ('Departamento de Intendencia y Automotores', 'Intendencia y Automotores'),
  ('Área de Prensa', 'Prensa'),
  ('Área de Sistemas', 'Sistemas'),
  ('Área de Regularización Dominial', 'Regularización Dominial'),
  ('Instituto Correntino del Agua y el Ambiente', 'Agua y el Ambiente'),
  ('Instituto Provincial del Tabaco', 'Tabaco');

ALTER TABLE public.profiles
ADD COLUMN area_id UUID REFERENCES public.areas(id);
