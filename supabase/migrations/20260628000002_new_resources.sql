-- 20260628_02_new_resources.sql
ALTER TABLE public.resources 
  DROP CONSTRAINT IF EXISTS resources_type_check;

ALTER TABLE public.resources 
  ADD CONSTRAINT resources_type_check 
  CHECK (type IN (
    'oxygen','water','energy','minerals','food','research_points',
    'consumer_goods','rare_metals','databanks','nanomaterials'
  ));
