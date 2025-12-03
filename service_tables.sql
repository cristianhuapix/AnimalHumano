Creating tables...
Note: These SQL statements need to be run in Supabase SQL Editor:

================================================================================
TRAININGS TABLE:
================================================================================

CREATE TABLE IF NOT EXISTS public.trainings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

-- Policy: Providers can insert their own records
CREATE POLICY "Providers can insert trainings"
    ON public.trainings FOR INSERT
    WITH CHECK (profile_id = auth.uid());

-- Policy: Providers can view their own records
CREATE POLICY "Providers can view their trainings"
    ON public.trainings FOR SELECT
    USING (profile_id = auth.uid());

-- Policy: Providers can update their own records
CREATE POLICY "Providers can update their trainings"
    ON public.trainings FOR UPDATE
    USING (profile_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS trainings_pet_id_idx ON public.trainings(pet_id);
CREATE INDEX IF NOT EXISTS trainings_provider_id_idx ON public.trainings(provider_id);
CREATE INDEX IF NOT EXISTS trainings_profile_id_idx ON public.trainings(profile_id);


================================================================================
GROOMING TABLE:
================================================================================

CREATE TABLE IF NOT EXISTS public.grooming (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.grooming ENABLE ROW LEVEL SECURITY;

-- Policy: Providers can insert their own records
CREATE POLICY "Providers can insert grooming"
    ON public.grooming FOR INSERT
    WITH CHECK (profile_id = auth.uid());

-- Policy: Providers can view their own records
CREATE POLICY "Providers can view their grooming"
    ON public.grooming FOR SELECT
    USING (profile_id = auth.uid());

-- Policy: Providers can update their own records
CREATE POLICY "Providers can update their grooming"
    ON public.grooming FOR UPDATE
    USING (profile_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS grooming_pet_id_idx ON public.grooming(pet_id);
CREATE INDEX IF NOT EXISTS grooming_provider_id_idx ON public.grooming(provider_id);
CREATE INDEX IF NOT EXISTS grooming_profile_id_idx ON public.grooming(profile_id);


================================================================================
SHELTER_ADOPTIONS TABLE:
================================================================================

CREATE TABLE IF NOT EXISTS public.shelter_adoptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.shelter_adoptions ENABLE ROW LEVEL SECURITY;

-- Policy: Providers can insert their own records
CREATE POLICY "Providers can insert shelter_adoptions"
    ON public.shelter_adoptions FOR INSERT
    WITH CHECK (profile_id = auth.uid());

-- Policy: Providers can view their own records
CREATE POLICY "Providers can view their shelter_adoptions"
    ON public.shelter_adoptions FOR SELECT
    USING (profile_id = auth.uid());

-- Policy: Providers can update their own records
CREATE POLICY "Providers can update their shelter_adoptions"
    ON public.shelter_adoptions FOR UPDATE
    USING (profile_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS shelter_adoptions_pet_id_idx ON public.shelter_adoptions(pet_id);
CREATE INDEX IF NOT EXISTS shelter_adoptions_provider_id_idx ON public.shelter_adoptions(provider_id);
CREATE INDEX IF NOT EXISTS shelter_adoptions_profile_id_idx ON public.shelter_adoptions(profile_id);

