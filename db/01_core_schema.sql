-- ==========================================================
-- ANIMAL HUMANO - CORE SCHEMA v2
-- Basado en PRD v1
-- ==========================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "earthdistance" cascade;

-- ==========================================================
-- PROFILES Y USUARIOS
-- ==========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  first_name text,
  last_name text,
  phone text,
  address text,
  city text,
  country text not null default 'AR',
  language text not null default 'es' check (language in ('es', 'en', 'pt')),
  photo_url text,
  is_admin boolean not null default false,
  is_provider boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_format check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

create index idx_profiles_email on public.profiles(email);
create index idx_profiles_country on public.profiles(country);
create index idx_profiles_is_provider on public.profiles(id, is_provider);

-- ==========================================================
-- NOTIFICATION SETTINGS (PRD Sección 14)
-- ==========================================================

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  general_enabled boolean not null default true,
  chat_enabled boolean not null default true,
  vaccines_enabled boolean not null default true,
  appointments_enabled boolean not null default true,
  lost_pets_enabled boolean not null default true,
  lost_pets_radius_km numeric(5,2) default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_setting_per_user unique(profile_id)
);

create index idx_notification_settings_profile on public.notification_settings(profile_id);

-- ==========================================================
-- SPECIES Y BREEDS (INMUTABLES)
-- ==========================================================

create table if not exists public.species (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique, -- 3 letras para DNIA (ej: PER, GAT)
  created_at timestamptz not null default now()
);

create table if not exists public.breeds (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null references public.species(id) on delete cascade,
  name text not null,
  code text not null, -- 2 letras para DNIA (ej: LA, SI)
  created_at timestamptz not null default now(),
  constraint breeds_species_name_unique unique(species_id, name)
);

create index idx_breeds_species on public.breeds(species_id);

-- ==========================================================
-- PETS (MASCOTAS)
-- ==========================================================

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  birth_date date not null,
  species_id uuid not null references public.species(id),
  breed_id uuid not null references public.breeds(id),
  sex text not null check (sex in ('M','F')),
  photo_url text,
  papers_url text,
  crossable boolean not null default false,
  has_pedigree boolean not null default false,
  dnia text unique, -- Auto-generado: ARPERJR0000001
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint birth_date_valid check (birth_date <= current_date)
);

create index idx_pets_owner on public.pets(owner_id, is_deleted);
create index idx_pets_species on public.pets(species_id, is_deleted);
create index idx_pets_breed on public.pets(breed_id, is_deleted);
create index idx_pets_dnia on public.pets(dnia);
create index idx_pets_crossable on public.pets(species_id, breed_id, sex, birth_date, crossable, is_deleted);

-- ==========================================================
-- QR CODES (PRD Sección 7 - Acceso temporal)
-- ==========================================================

create table if not exists public.pet_qr_codes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  qr_code text unique not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint qr_code_format check (length(qr_code) >= 16)
);

create index idx_pet_qr_codes_pet on public.pet_qr_codes(pet_id) ;
create index idx_pet_qr_codes_code on public.pet_qr_codes(qr_code) ;

-- ==========================================================
-- QR SCANS (Acceso temporal veterinarios - 2 horas)
-- ==========================================================

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  scanned_by uuid not null references public.profiles(id) on delete cascade,
  qr_code text not null,
  scanned_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  scan_type text not null check (scan_type in ('veterinary', 'walk_start', 'walk_end', 'general')),
  is_active boolean not null default true
);

create index idx_qr_scans_pet on public.qr_scans(pet_id, scanned_at desc);
create index idx_qr_scans_scanned_by on public.qr_scans(scanned_by);
create index idx_qr_scans_active on public.qr_scans(pet_id, scanned_by, expires_at);

-- ==========================================================
-- VACCINES
-- ==========================================================

create table if not exists public.vaccines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species_id uuid references public.species(id) on delete cascade,
  required boolean not null default false,
  description text,
  interval_days int,
  contagious_to_humans boolean not null default false,
  created_at timestamptz not null default now(),
  constraint interval_days_positive check (interval_days is null or interval_days > 0)
);

create index idx_vaccines_species on public.vaccines(species_id);
create index idx_vaccines_required on public.vaccines(species_id) ;

create table if not exists public.pet_vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_id uuid not null references public.vaccines(id) on delete restrict,
  applied_on date not null,
  next_due_on date,
  applied_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint applied_date_valid check (applied_on <= current_date),
  constraint next_due_after_applied check (next_due_on is null or next_due_on > applied_on)
);

create index idx_pet_vaccinations_pet on public.pet_vaccinations(pet_id, applied_on desc);
create index idx_pet_vaccinations_next_due on public.pet_vaccinations(pet_id, next_due_on);

-- ==========================================================
-- MEDICAL RECORDS
-- ==========================================================

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  record_date date not null,
  title text not null,
  description text not null,
  attachments jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint record_date_valid check (record_date <= current_date)
);

create index idx_medical_records_pet on public.medical_records(pet_id, record_date desc);

-- ==========================================================
-- PROVIDERS (PRD Sección 8)
-- ==========================================================

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_type text not null check (service_type in ('veterinarian', 'groomer', 'walker', 'trainer', 'sitter', 'petshop', 'shelter', 'other')),
  description text,
  license_number text,
  license_verified boolean not null default false,
  address text,
  google_place_id text,
  latitude numeric(10,8),
  longitude numeric(11,8),
  rating numeric(3,2) default 0,
  rating_count int default 0,
  active boolean not null default true,
  plan_type text default 'free' check (plan_type in ('free', 'basic', 'premium')),
  plan_fee numeric(10,2) default 0,
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rating_range check (rating >= 0 and rating <= 5),
  constraint unique_profile_service unique(profile_id, service_type)
);

create index idx_providers_profile on public.providers(profile_id);
create index idx_providers_service on public.providers(service_type) ;
-- Note: earthdistance ll_to_earth() is not IMMUTABLE, using btree on lat/long instead
create index idx_providers_latitude on public.providers(latitude) ;
create index idx_providers_longitude on public.providers(longitude) ;

-- ==========================================================
-- PROVIDER RATINGS (1 cada 30 días - PRD Sección 8)
-- ==========================================================

create table if not exists public.provider_ratings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  rated_by uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index idx_provider_ratings_provider on public.provider_ratings(provider_id, created_at desc);
create index idx_provider_ratings_user on public.provider_ratings(rated_by, created_at desc);

-- Trigger para actualizar rating promedio del proveedor
create or replace function update_provider_rating()
returns trigger as $$
begin
  update public.providers
  set rating = (
    select round(avg(rating)::numeric, 2)
    from public.provider_ratings
    where provider_id = new.provider_id
  ),
  rating_count = (
    select count(*)
    from public.provider_ratings
    where provider_id = new.provider_id
  )
  where id = new.provider_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_provider_rating on public.provider_ratings;
create trigger trg_update_provider_rating
  after insert on public.provider_ratings
  for each row execute function update_provider_rating();

-- Trigger para validar rate limit de 1 rating cada 30 días
create or replace function check_rating_rate_limit()
returns trigger as $$
declare
  v_last_rating timestamptz;
begin
  select max(created_at) into v_last_rating
  from public.provider_ratings
  where provider_id = new.provider_id
    and rated_by = new.rated_by;

  if v_last_rating is not null and v_last_rating > now() - interval '30 days' then
    raise exception 'You can only rate this provider once every 30 days';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_check_rating_rate_limit on public.provider_ratings;
create trigger trg_check_rating_rate_limit
  before insert on public.provider_ratings
  for each row execute function check_rating_rate_limit();

-- ==========================================================
-- AVAILABILITY SCHEDULES
-- ==========================================================

create table if not exists public.availability_schedules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint time_range_valid check (end_time > start_time)
);

create index idx_availability_provider on public.availability_schedules(provider_id, day_of_week);

-- ==========================================================
-- APPOINTMENTS (PRD Sección 10)
-- ==========================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  scheduled_at timestamptz not null,
  duration_mins int not null default 30,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duration_positive check (duration_mins > 0)
);

create index idx_appointments_user on public.appointments(user_id, scheduled_at);
create index idx_appointments_provider on public.appointments(provider_id, scheduled_at);
create index idx_appointments_status on public.appointments(status, scheduled_at);

-- Continúa en 02_breeding_walks.sql...
