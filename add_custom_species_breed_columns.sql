-- ============================================
-- AGREGAR COLUMNAS PARA ESPECIES Y RAZAS PERSONALIZADAS
-- Permite a los usuarios ingresar nombres personalizados
-- cuando seleccionan "Otra" especie o raza
-- ============================================

-- Agregar columnas si no existen
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS other_species_name text,
  ADD COLUMN IF NOT EXISTS other_breed_name text;

-- Comentarios
COMMENT ON COLUMN public.pets.other_species_name IS 'Nombre personalizado de especie cuando species_id es "other"';
COMMENT ON COLUMN public.pets.other_breed_name IS 'Nombre personalizado de raza cuando breed_id es "other"';
