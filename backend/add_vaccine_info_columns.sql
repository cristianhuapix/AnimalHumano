-- Add transmission and importance columns to vaccines table

ALTER TABLE vaccines
ADD COLUMN IF NOT EXISTS transmission TEXT,
ADD COLUMN IF NOT EXISTS importance TEXT;

-- Update existing vaccines with default information
UPDATE vaccines
SET
  transmission = CASE
    WHEN transmission IS NULL THEN 'Contacto directo, saliva, secreciones corporales'
    ELSE transmission
  END,
  importance = CASE
    WHEN importance IS NULL AND required = true THEN 'Vacuna obligatoria que previene enfermedades graves y potencialmente mortales'
    WHEN importance IS NULL AND required = false THEN 'Vacuna recomendada que ayuda a prevenir enfermedades que pueden afectar la calidad de vida'
    ELSE importance
  END;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vaccines'
ORDER BY column_name;
