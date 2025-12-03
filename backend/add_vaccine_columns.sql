-- Add batch_number and veterinarian_name columns to pet_vaccinations table

ALTER TABLE pet_vaccinations
ADD COLUMN IF NOT EXISTS batch_number TEXT,
ADD COLUMN IF NOT EXISTS veterinarian_name TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pet_vaccinations'
ORDER BY column_name;
