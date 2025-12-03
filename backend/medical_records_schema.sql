-- Create medical_records table
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    veterinarian_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    veterinarian_name VARCHAR(255),
    attachment_url TEXT,
    attachment_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id for faster queries
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON medical_records(pet_id);

-- Create index on veterinarian_id for faster queries
CREATE INDEX IF NOT EXISTS idx_medical_records_veterinarian_id ON medical_records(veterinarian_id);

-- Create index on date for sorting
CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records(date DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view medical records of their pets" ON medical_records;
DROP POLICY IF EXISTS "Users can create medical records for their pets" ON medical_records;
DROP POLICY IF EXISTS "Providers can view medical records with QR access" ON medical_records;
DROP POLICY IF EXISTS "Providers can create medical records" ON medical_records;
DROP POLICY IF EXISTS "Users can update their own medical records" ON medical_records;
DROP POLICY IF EXISTS "Veterinarians can update records they created" ON medical_records;
DROP POLICY IF EXISTS "Users can delete their own medical records" ON medical_records;

-- Create policy for users to view medical records of their own pets
CREATE POLICY "Users can view medical records of their pets"
ON medical_records FOR SELECT
USING (
    pet_id IN (
        SELECT id FROM pets WHERE owner_id = auth.uid()
    )
);

-- Create policy for users to insert medical records for their own pets
CREATE POLICY "Users can create medical records for their pets"
ON medical_records FOR INSERT
WITH CHECK (
    pet_id IN (
        SELECT id FROM pets WHERE owner_id = auth.uid()
    )
);

-- Create policy for providers to view medical records of pets they have access to
-- (when they scan a QR code, they get temporary access)
CREATE POLICY "Providers can view medical records with QR access"
ON medical_records FOR SELECT
USING (
    -- This will be enforced at the application level using QR access tokens
    true
);

-- Create policy for providers to create medical records
CREATE POLICY "Providers can create medical records"
ON medical_records FOR INSERT
WITH CHECK (
    -- Providers can create medical records when they have QR access
    -- This will be enforced at the application level
    true
);

-- Create policy for users to update their own medical records
CREATE POLICY "Users can update their own medical records"
ON medical_records FOR UPDATE
USING (
    pet_id IN (
        SELECT id FROM pets WHERE owner_id = auth.uid()
    )
);

-- Create policy for veterinarians to update records they created
CREATE POLICY "Veterinarians can update records they created"
ON medical_records FOR UPDATE
USING (veterinarian_id = auth.uid());

-- Create policy for users to delete their own medical records
CREATE POLICY "Users can delete their own medical records"
ON medical_records FOR DELETE
USING (
    pet_id IN (
        SELECT id FROM pets WHERE owner_id = auth.uid()
    )
);

-- Create storage bucket for medical record attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-records', 'medical-records', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for medical records
CREATE POLICY "Users can upload medical record attachments for their pets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'medical-records' AND
    auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view medical record attachments for their pets"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'medical-records' AND
    auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own medical record attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'medical-records' AND
    auth.uid() IS NOT NULL
);
