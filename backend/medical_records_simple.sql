-- Step 1: Create the medical_records table
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
