-- Add provider_id column to pet_vaccinations table
ALTER TABLE pet_vaccinations
ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_provider_id ON pet_vaccinations(provider_id);

-- Add comment to column
COMMENT ON COLUMN pet_vaccinations.provider_id IS 'ID del proveedor (veterinario) que aplicó la vacuna';
