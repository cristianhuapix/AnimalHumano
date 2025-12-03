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

create index idx_pet_qr_codes_pet on public.pet_qr_codes(pet_id);
create index idx_pet_qr_codes_code on public.pet_qr_codes(qr_code);

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
create index idx_vaccines_required on public.vaccines(species_id);

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
create index idx_providers_service on public.providers(service_type);
-- Note: earthdistance ll_to_earth() is not IMMUTABLE, using btree on lat/long instead
create index idx_providers_latitude on public.providers(latitude);
create index idx_providers_longitude on public.providers(longitude);

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
-- ==========================================================
-- BREEDING & WALKS
-- ==========================================================

-- ==========================================================
-- BREEDING INTENTS (PRD Sección 9 - Cruces)
-- ==========================================================

create table if not exists public.pet_breeding_intents (
  id uuid primary key default gen_random_uuid(),
  from_pet_id uuid not null references public.pets(id) on delete cascade,
  to_pet_id uuid not null references public.pets(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint different_pets check (from_pet_id <> to_pet_id)
);

create index idx_breeding_intents_from on public.pet_breeding_intents(from_pet_id, created_at desc);
create index idx_breeding_intents_to on public.pet_breeding_intents(to_pet_id, status);
create index idx_breeding_intents_pending on public.pet_breeding_intents(to_pet_id, status);

-- Vista pública de mascotas para cruce
create or replace view public.breeding_public as
select
  p.id as pet_id,
  p.name,
  p.photo_url,
  p.species_id,
  s.name as species_name,
  p.breed_id,
  b.name as breed_name,
  p.has_pedigree,
  p.sex,
  p.dnia,
  date_part('year', age(p.birth_date)) as age_years,
  p.owner_id,
  prof.city,
  prof.country
from public.pets p
inner join public.species s on s.id = p.species_id
inner join public.breeds b on b.id = p.breed_id
inner join public.profiles prof on prof.id = p.owner_id
where p.crossable = true
  and p.is_deleted = false
  and prof.is_deleted = false
  and p.birth_date < current_date - interval '1 year'; -- Min 1 año

-- ==========================================================
-- WALKS (PRD Sección 12)
-- ==========================================================

create table if not exists public.walks (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  walker_id uuid not null references public.providers(id) on delete restrict,
  pickup_scanned_at timestamptz,
  dropoff_scanned_at timestamptz,
  auto_closed boolean not null default false,
  notes text,
  route_data jsonb, -- Puede guardar puntos GPS del recorrido
  created_at timestamptz not null default now(),
  constraint dropoff_after_pickup check (
    dropoff_scanned_at is null or dropoff_scanned_at > pickup_scanned_at
  )
);

create index idx_walks_pet on public.walks(pet_id, created_at desc);
create index idx_walks_walker on public.walks(walker_id, created_at desc);
create index idx_walks_active on public.walks(pet_id, pickup_scanned_at, dropoff_scanned_at);

-- Función para autocierre de paseos después de 10h (PRD Sección 12)
create or replace function public.autoclose_walks()
returns int as $$
declare
  v_count int;
begin
  update public.walks
  set dropoff_scanned_at = now(),
      auto_closed = true,
      notes = coalesce(notes || E'\n', '') || 'Auto-cerrado después de 10 horas'
  where dropoff_scanned_at is null
    and pickup_scanned_at is not null
    and pickup_scanned_at < now() - interval '10 hours';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- LOST PET REPORTS (PRD Sección 11)
-- ==========================================================

create table if not exists public.lost_pet_reports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  report_type text not null check (report_type in ('lost', 'found')),
  species_id uuid references public.species(id),
  breed_id uuid references public.breeds(id),
  description text not null,
  contact_phone text, -- Opcional según PRD
  last_seen_at timestamptz,
  latitude numeric(10,8),
  longitude numeric(11,8),
  found boolean not null default false,
  found_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint found_at_valid check (not found or found_at is not null)
);

create index idx_lost_pet_reports_pet on public.lost_pet_reports(pet_id);
create index idx_lost_pet_reports_reporter on public.lost_pet_reports(reporter_id);
create index idx_lost_pet_reports_active on public.lost_pet_reports(species_id, breed_id, created_at desc);
-- Note: earthdistance ll_to_earth() is not IMMUTABLE, using btree on lat/long instead
create index idx_lost_pet_reports_latitude on public.lost_pet_reports(latitude);
create index idx_lost_pet_reports_longitude on public.lost_pet_reports(longitude);

create table if not exists public.lost_pet_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lost_pet_reports(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create index idx_lost_pet_images_report on public.lost_pet_images(report_id);

-- ==========================================================
-- FUNCIONES DE GEOLOCALIZACIÓN (PRD Sección 11)
-- ==========================================================

-- Buscar mascotas perdidas cercanas
create or replace function public.find_nearby_lost_pets(
  p_latitude numeric,
  p_longitude numeric,
  p_radius_km numeric default 10,
  p_species_id uuid default null
)
returns table(
  report_id uuid,
  pet_id uuid,
  pet_name text,
  species_name text,
  breed_name text,
  description text,
  contact_phone text,
  last_seen_at timestamptz,
  distance_km numeric,
  latitude numeric,
  longitude numeric,
  images jsonb
) as $$
begin
  return query
  select
    lpr.id,
    lpr.pet_id,
    p.name,
    s.name,
    b.name,
    lpr.description,
    lpr.contact_phone,
    lpr.last_seen_at,
    round(
      earth_distance(
        ll_to_earth(p_latitude, p_longitude),
        ll_to_earth(lpr.latitude, lpr.longitude)
      ) / 1000.0,
      2
    ) as distance_km,
    lpr.latitude,
    lpr.longitude,
    (
      select jsonb_agg(jsonb_build_object('url', image_url))
      from public.lost_pet_images
      where report_id = lpr.id
    ) as images
  from public.lost_pet_reports lpr
  left join public.pets p on p.id = lpr.pet_id
  left join public.species s on s.id = coalesce(lpr.species_id, p.species_id)
  left join public.breeds b on b.id = coalesce(lpr.breed_id, p.breed_id)
  where lpr.found = false
    and lpr.latitude is not null
    and lpr.longitude is not null
    and (p_species_id is null or coalesce(lpr.species_id, p.species_id) = p_species_id)
    and earth_distance(
      ll_to_earth(p_latitude, p_longitude),
      ll_to_earth(lpr.latitude, lpr.longitude)
    ) <= p_radius_km * 1000
  order by distance_km;
end;
$$ language plpgsql security definer;

-- Buscar proveedores cercanos
create or replace function public.find_nearby_providers(
  p_latitude numeric,
  p_longitude numeric,
  p_radius_km numeric default 10,
  p_service_type text default null
)
returns table(
  provider_id uuid,
  profile_id uuid,
  full_name text,
  service_type text,
  description text,
  address text,
  rating numeric,
  rating_count int,
  distance_km numeric,
  latitude numeric,
  longitude numeric
) as $$
begin
  return query
  select
    prov.id,
    prov.profile_id,
    prof.full_name,
    prov.service_type,
    prov.description,
    prov.address,
    prov.rating,
    prov.rating_count,
    round(
      earth_distance(
        ll_to_earth(p_latitude, p_longitude),
        ll_to_earth(prov.latitude, prov.longitude)
      ) / 1000.0,
      2
    ) as distance_km,
    prov.latitude,
    prov.longitude
  from public.providers prov
  inner join public.profiles prof on prof.id = prov.profile_id
  where prov.active = true
    and prov.latitude is not null
    and prov.longitude is not null
    and (p_service_type is null or prov.service_type = p_service_type)
    and earth_distance(
      ll_to_earth(p_latitude, p_longitude),
      ll_to_earth(prov.latitude, prov.longitude)
    ) <= p_radius_km * 1000
  order by distance_km;
end;
$$ language plpgsql security definer;

-- Continúa en 03_conversations_notifications.sql...
-- ==========================================================
-- CONVERSATIONS, MESSAGES & NOTIFICATIONS
-- ==========================================================

-- ==========================================================
-- CONVERSATIONS (PRD Sección 13)
-- ==========================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_provider boolean not null default false, -- Para validar restricciones
  joined_at timestamptz not null default now(),
  hidden boolean not null default false, -- Para "eliminar" chat
  constraint conversation_participant_unique unique(conversation_id, profile_id)
);

create index idx_conversation_participants_profile on public.conversation_participants(profile_id, hidden);
create index idx_conversation_participants_conv on public.conversation_participants(conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint content_not_empty check (length(trim(content)) > 0)
);

create index idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index idx_messages_sender on public.messages(sender_id);
create index idx_messages_unread on public.messages(conversation_id);

-- Trigger para actualizar conversation.updated_at
create or replace function update_conversation_timestamp()
returns trigger as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_conversation on public.messages;
create trigger trg_update_conversation
  after insert on public.messages
  for each row execute function update_conversation_timestamp();

-- ==========================================================
-- RATE LIMITING (PRD Sección 17 - Anti-spam)
-- ==========================================================

create table if not exists public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (action_type in ('message', 'breeding_intent', 'lost_pet_report', 'provider_rating')),
  action_count int not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint unique_rate_limit unique(profile_id, action_type, window_start)
);

create index idx_rate_limits_profile_action on public.rate_limits(profile_id, action_type, window_start);

-- Función para verificar rate limit
create or replace function check_rate_limit(
  p_profile_id uuid,
  p_action_type text,
  p_max_count int,
  p_window_interval interval
)
returns boolean as $$
declare
  v_count int;
  v_window_start timestamptz;
begin
  -- Calcular inicio de ventana según tipo
  if p_action_type = 'message' then
    v_window_start := date_trunc('hour', now());
  elsif p_action_type = 'breeding_intent' then
    v_window_start := date_trunc('day', now() - interval '7 days');
  elsif p_action_type = 'lost_pet_report' then
    v_window_start := date_trunc('day', now());
  elsif p_action_type = 'provider_rating' then
    v_window_start := date_trunc('day', now() - interval '30 days');
  else
    v_window_start := date_trunc('hour', now());
  end if;

  -- Contar acciones en la ventana
  select coalesce(sum(action_count), 0) into v_count
  from public.rate_limits
  where profile_id = p_profile_id
    and action_type = p_action_type
    and window_start >= v_window_start;

  -- Si excede el límite, retornar false
  if v_count >= p_max_count then
    return false;
  end if;

  -- Registrar acción
  insert into public.rate_limits (profile_id, action_type, window_start, action_count)
  values (p_profile_id, p_action_type, v_window_start, 1)
  on conflict (profile_id, action_type, window_start)
  do update set action_count = public.rate_limits.action_count + 1;

  return true;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- NOTIFICATIONS (PRD Sección 14)
-- ==========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('vaccine_reminder', 'appointment_reminder', 'message', 'lost_pet_alert', 'breeding_request', 'system', 'walk_started', 'walk_ended')),
  title text not null,
  body text not null,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index idx_notifications_profile on public.notifications(profile_id, created_at desc);
create index idx_notifications_unread on public.notifications(profile_id);
-- ==========================================================
-- DEVICE TOKENS (Push Notifications)
-- ==========================================================

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_token_unique unique(profile_id, token)
);

create index idx_device_tokens_profile on public.device_tokens(profile_id);

-- ==========================================================
-- CALENDAR VIEW (PRD Sección 10)
-- ==========================================================

-- Vista unificada de eventos del calendario
create or replace view public.calendar_events as
-- Citas
select
  a.id,
  'appointment' as event_type,
  a.user_id as profile_id,
  a.scheduled_at as event_date,
  a.duration_mins,
  'blue' as color,
  p.name as pet_name,
  prov_profile.full_name as provider_name,
  a.notes as description,
  a.status
from public.appointments a
left join public.pets p on p.id = a.pet_id
left join public.providers prov on prov.id = a.provider_id
left join public.profiles prov_profile on prov_profile.id = prov.profile_id
where a.status in ('pending', 'confirmed')

union all

-- Vacunas obligatorias
select
  pv.id,
  'vaccine_required' as event_type,
  p.owner_id as profile_id,
  pv.next_due_on::timestamptz as event_date,
  30 as duration_mins,
  'red' as color,
  p.name as pet_name,
  v.name as provider_name,
  v.description,
  'pending' as status
from public.pet_vaccinations pv
join public.pets p on p.id = pv.pet_id
join public.vaccines v on v.id = pv.vaccine_id
where pv.next_due_on is not null
  and pv.next_due_on >= current_date
  and v.required = true

union all

-- Vacunas opcionales
select
  pv.id,
  'vaccine_optional' as event_type,
  p.owner_id as profile_id,
  pv.next_due_on::timestamptz as event_date,
  30 as duration_mins,
  'yellow' as color,
  p.name as pet_name,
  v.name as provider_name,
  v.description,
  'pending' as status
from public.pet_vaccinations pv
join public.pets p on p.id = pv.pet_id
join public.vaccines v on v.id = pv.vaccine_id
where pv.next_due_on is not null
  and pv.next_due_on >= current_date
  and v.required = false;

-- Continúa en 04_triggers_functions.sql...
-- ==========================================================
-- TRIGGERS & FUNCTIONS
-- ==========================================================

-- ==========================================================
-- AUTO-UPDATE TIMESTAMPS
-- ==========================================================

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Aplicar a todas las tablas con updated_at
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at();

drop trigger if exists trg_pets_updated_at on public.pets;
create trigger trg_pets_updated_at before update on public.pets
for each row execute function public.update_updated_at();

drop trigger if exists trg_providers_updated_at on public.providers;
create trigger trg_providers_updated_at before update on public.providers
for each row execute function public.update_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments
for each row execute function public.update_updated_at();

drop trigger if exists trg_breeding_intents_updated_at on public.pet_breeding_intents;
create trigger trg_breeding_intents_updated_at before update on public.pet_breeding_intents
for each row execute function public.update_updated_at();

drop trigger if exists trg_lost_pet_reports_updated_at on public.lost_pet_reports;
create trigger trg_lost_pet_reports_updated_at before update on public.lost_pet_reports
for each row execute function public.update_updated_at();

drop trigger if exists trg_notification_settings_updated_at on public.notification_settings;
create trigger trg_notification_settings_updated_at before update on public.notification_settings
for each row execute function public.update_updated_at();

drop trigger if exists trg_device_tokens_updated_at on public.device_tokens;
create trigger trg_device_tokens_updated_at before update on public.device_tokens
for each row execute function public.update_updated_at();

-- ==========================================================
-- DNIA GENERATION (PRD Sección 6)
-- Formato: ARPERJR0000001 (2 país + 3 especie + 2 raza + 7 dígitos)
-- ==========================================================

create or replace function public.generate_dnia(
  country_code text,
  species_code text,
  breed_code text,
  seq int
)
returns text as $$
begin
  return upper(
    country_code ||
    species_code ||
    breed_code ||
    lpad(seq::text, 7, '0')
  );
end;
$$ language plpgsql immutable;

create or replace function public.trg_set_dnia()
returns trigger as $$
declare
  seq int;
  sp_code text;
  br_code text;
  co_code text;
begin
  -- Si ya tiene DNIA, no hacer nada
  if new.dnia is not null then
    return new;
  end if;

  -- Obtener código de especie
  select code into sp_code
  from public.species
  where id = new.species_id;

  -- Obtener código de raza
  select code into br_code
  from public.breeds
  where id = new.breed_id;

  -- Obtener código de país (2 letras)
  select upper(substring(country, 1, 2)) into co_code
  from public.profiles
  where id = new.owner_id;

  -- Calcular siguiente número secuencial
  select coalesce(max(
    substring(dnia from '.{7}$')::int
  ), 0) + 1 into seq
  from public.pets
  where dnia like co_code || sp_code || br_code || '%';

  -- Generar DNIA
  new.dnia := public.generate_dnia(co_code, sp_code, br_code, seq);

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_dnia on public.pets;
create trigger trg_set_dnia
  before insert on public.pets
  for each row
  execute function public.trg_set_dnia();

-- ==========================================================
-- INMUTABILIDAD (PRD - Especie y Raza inmutables)
-- ==========================================================

create or replace function public.prevent_species_breed_change()
returns trigger as $$
begin
  if new.species_id <> old.species_id then
    raise exception 'La especie no se puede cambiar una vez creada la mascota';
  end if;
  if new.breed_id <> old.breed_id then
    raise exception 'La raza no se puede cambiar una vez creada la mascota';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_species_breed_change on public.pets;
create trigger trg_prevent_species_breed_change
  before update on public.pets
  for each row
  execute function public.prevent_species_breed_change();

-- ==========================================================
-- PREVENIR HARD DELETE EN MASCOTAS (Soft delete obligatorio)
-- ==========================================================

create or replace function public.prevent_hard_delete_pets()
returns trigger as $$
begin
  raise exception 'No se pueden eliminar mascotas físicamente. Use is_deleted = true';
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_hard_delete_pets on public.pets;
create trigger trg_prevent_hard_delete_pets
  before delete on public.pets
  for each row
  execute function public.prevent_hard_delete_pets();

-- ==========================================================
-- VALIDAR ACCESO TEMPORAL QR (2 horas veterinarios - PRD Sección 7)
-- ==========================================================

create or replace function public.has_qr_access(
  p_pet_id uuid,
  p_profile_id uuid
)
returns boolean as $$
declare
  v_has_access boolean;
begin
  -- Verificar si es el dueño
  if exists(
    select 1 from public.pets
    where id = p_pet_id and owner_id = p_profile_id
  ) then
    return true;
  end if;

  -- Verificar si tiene acceso temporal activo (2h)
  select exists(
    select 1 from public.qr_scans
    where pet_id = p_pet_id
      and scanned_by = p_profile_id
      and is_active = true
      and expires_at > now()
  ) into v_has_access;

  return v_has_access;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- FUNCIONES DE PASEOS (PRD Sección 12)
-- ==========================================================

-- Iniciar paseo escaneando QR
create or replace function public.start_walk(
  p_pet_id uuid,
  p_walker_id uuid,
  p_qr_code text
)
returns uuid as $$
declare
  v_walk_id uuid;
  v_qr_valid boolean;
  v_provider_is_walker boolean;
begin
  -- Validar QR code
  select exists(
    select 1 from public.pet_qr_codes
    where pet_id = p_pet_id
      and qr_code = p_qr_code
      and is_active = true
      and (expires_at is null or expires_at > now())
  ) into v_qr_valid;

  if not v_qr_valid then
    raise exception 'QR code inválido o expirado';
  end if;

  -- Verificar que sea paseador
  select exists(
    select 1 from public.providers
    where id = p_walker_id
      and service_type = 'walker'
      and active = true
  ) into v_provider_is_walker;

  if not v_provider_is_walker then
    raise exception 'Solo paseadores pueden iniciar paseos';
  end if;

  -- Verificar que no haya un paseo activo
  if exists(
    select 1 from public.walks
    where pet_id = p_pet_id
      and pickup_scanned_at is not null
      and dropoff_scanned_at is null
  ) then
    raise exception 'Ya existe un paseo activo para esta mascota';
  end if;

  -- Registrar scan del QR
  insert into public.qr_scans (pet_id, scanned_by, qr_code, scan_type)
  select p_pet_id, profile_id, p_qr_code, 'walk_start'
  from public.providers
  where id = p_walker_id;

  -- Crear paseo
  insert into public.walks (pet_id, walker_id, pickup_scanned_at)
  values (p_pet_id, p_walker_id, now())
  returning id into v_walk_id;

  return v_walk_id;
end;
$$ language plpgsql security definer;

-- Finalizar paseo escaneando QR
create or replace function public.end_walk(
  p_walk_id uuid,
  p_qr_code text
)
returns boolean as $$
declare
  v_pet_id uuid;
  v_walker_profile_id uuid;
  v_qr_valid boolean;
begin
  -- Obtener datos del paseo
  select w.pet_id, prov.profile_id into v_pet_id, v_walker_profile_id
  from public.walks w
  join public.providers prov on prov.id = w.walker_id
  where w.id = p_walk_id
    and w.pickup_scanned_at is not null
    and w.dropoff_scanned_at is null;

  if v_pet_id is null then
    raise exception 'Paseo no encontrado o ya finalizado';
  end if;

  -- Validar QR code
  select exists(
    select 1 from public.pet_qr_codes
    where pet_id = v_pet_id
      and qr_code = p_qr_code
      and is_active = true
      and (expires_at is null or expires_at > now())
  ) into v_qr_valid;

  if not v_qr_valid then
    raise exception 'QR code inválido o expirado';
  end if;

  -- Registrar scan
  insert into public.qr_scans (pet_id, scanned_by, qr_code, scan_type)
  values (v_pet_id, v_walker_profile_id, p_qr_code, 'walk_end');

  -- Finalizar paseo
  update public.walks
  set dropoff_scanned_at = now()
  where id = p_walk_id;

  return true;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- VALIDACIÓN DE COMPATIBILIDAD PARA CRUCES
-- ==========================================================

create or replace function public.validate_breeding_compatibility(
  p_from_pet_id uuid,
  p_to_pet_id uuid
)
returns table(
  compatible boolean,
  reason text
) as $$
declare
  v_from_pet record;
  v_to_pet record;
begin
  -- Obtener datos de ambas mascotas
  select * into v_from_pet
  from public.pets
  where id = p_from_pet_id and not is_deleted;

  select * into v_to_pet
  from public.pets
  where id = p_to_pet_id and not is_deleted;

  -- Validaciones
  if v_from_pet.id is null then
    return query select false, 'La mascota origen no existe o está eliminada';
    return;
  end if;

  if v_to_pet.id is null then
    return query select false, 'La mascota destino no existe o está eliminada';
    return;
  end if;

  if v_from_pet.species_id <> v_to_pet.species_id then
    return query select false, 'Las mascotas deben ser de la misma especie';
    return;
  end if;

  if v_from_pet.sex = v_to_pet.sex then
    return query select false, 'Las mascotas deben ser de sexos diferentes';
    return;
  end if;

  if not v_from_pet.crossable then
    return query select false, 'La mascota origen no está disponible para cruce';
    return;
  end if;

  if not v_to_pet.crossable then
    return query select false, 'La mascota destino no está disponible para cruce';
    return;
  end if;

  if v_from_pet.owner_id = v_to_pet.owner_id then
    return query select false, 'No puedes solicitar cruce entre tus propias mascotas';
    return;
  end if;

  if v_from_pet.birth_date > current_date - interval '1 year' then
    return query select false, 'La mascota origen debe tener al menos 1 año';
    return;
  end if;

  if v_to_pet.birth_date > current_date - interval '1 year' then
    return query select false, 'La mascota destino debe tener al menos 1 año';
    return;
  end if;

  -- Compatible
  return query select true, 'Compatible'::text;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- CREAR CONFIGURACIÓN DE NOTIFICACIONES AL CREAR PERFIL
-- ==========================================================

create or replace function public.create_default_notification_settings()
returns trigger as $$
begin
  insert into public.notification_settings (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_create_notification_settings on public.profiles;
create trigger trg_create_notification_settings
  after insert on public.profiles
  for each row
  execute function public.create_default_notification_settings();

-- Continúa en 05_rls_policies.sql...
-- ==========================================================
-- ROW LEVEL SECURITY POLICIES (PRD Sección 17)
-- ==========================================================

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.notification_settings enable row level security;
alter table public.pets enable row level security;
alter table public.pet_qr_codes enable row level security;
alter table public.qr_scans enable row level security;
alter table public.pet_vaccinations enable row level security;
alter table public.medical_records enable row level security;
alter table public.providers enable row level security;
alter table public.provider_ratings enable row level security;
alter table public.availability_schedules enable row level security;
alter table public.appointments enable row level security;
alter table public.pet_breeding_intents enable row level security;
alter table public.walks enable row level security;
alter table public.lost_pet_reports enable row level security;
alter table public.lost_pet_images enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.device_tokens enable row level security;

-- ==========================================================
-- PROFILES
-- ==========================================================

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can view other profiles (limited)"
  on public.profiles for select
  using (not is_deleted);

-- ==========================================================
-- NOTIFICATION SETTINGS
-- ==========================================================

create policy "Users can view own notification settings"
  on public.notification_settings for select
  using (auth.uid() = profile_id);

create policy "Users can update own notification settings"
  on public.notification_settings for update
  using (auth.uid() = profile_id);

-- ==========================================================
-- PETS
-- ==========================================================

create policy "Owners can view own pets"
  on public.pets for select
  using (auth.uid() = owner_id or not is_deleted);

create policy "Owners can insert own pets"
  on public.pets for insert
  with check (auth.uid() = owner_id);

create policy "Owners can update own pets"
  on public.pets for update
  using (auth.uid() = owner_id);

create policy "Owners can delete own pets"
  on public.pets for delete
  using (auth.uid() = owner_id);

-- ==========================================================
-- PET QR CODES
-- ==========================================================

create policy "Owners can view own pet QR codes"
  on public.pet_qr_codes for select
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Owners can manage own pet QR codes"
  on public.pet_qr_codes for all
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

-- ==========================================================
-- QR SCANS
-- ==========================================================

create policy "Users can view scans involving them"
  on public.qr_scans for select
  using (
    auth.uid() = scanned_by or
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

-- ==========================================================
-- VACCINATIONS
-- ==========================================================

create policy "Pet owners can view vaccinations"
  on public.pet_vaccinations for select
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Pet owners can insert vaccinations"
  on public.pet_vaccinations for insert
  with check (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Vets with QR access can insert vaccinations"
  on public.pet_vaccinations for insert
  with check (
    public.has_qr_access(pet_id, auth.uid())
  );

-- ==========================================================
-- MEDICAL RECORDS
-- ==========================================================

create policy "Pet owners can view medical records"
  on public.medical_records for select
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Vets with QR access can view medical records"
  on public.medical_records for select
  using (
    public.has_qr_access(pet_id, auth.uid())
  );

create policy "Pet owners can insert medical records"
  on public.medical_records for insert
  with check (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Vets with QR access can insert medical records"
  on public.medical_records for insert
  with check (
    public.has_qr_access(pet_id, auth.uid())
  );

-- ==========================================================
-- PROVIDERS
-- ==========================================================

create policy "Everyone can view active providers"
  on public.providers for select
  using (active);

create policy "Profile owners can manage their provider profiles"
  on public.providers for all
  using (auth.uid() = profile_id);

-- ==========================================================
-- PROVIDER RATINGS
-- ==========================================================

create policy "Everyone can view ratings"
  on public.provider_ratings for select
  using (true);

create policy "Users can insert ratings"
  on public.provider_ratings for insert
  with check (auth.uid() = rated_by);

-- ==========================================================
-- AVAILABILITY SCHEDULES
-- ==========================================================

create policy "Everyone can view schedules"
  on public.availability_schedules for select
  using (
    exists (
      select 1 from public.providers
      where id = provider_id and active = true
    )
  );

create policy "Providers can manage own schedules"
  on public.availability_schedules for all
  using (
    exists (
      select 1 from public.providers
      where id = provider_id and profile_id = auth.uid()
    )
  );

-- ==========================================================
-- APPOINTMENTS
-- ==========================================================

create policy "Users can view own appointments"
  on public.appointments for select
  using (
    auth.uid() = user_id or
    exists (
      select 1 from public.providers
      where id = provider_id and profile_id = auth.uid()
    )
  );

create policy "Users can create appointments"
  on public.appointments for insert
  with check (auth.uid() = user_id);

create policy "Users and providers can update appointments"
  on public.appointments for update
  using (
    auth.uid() = user_id or
    exists (
      select 1 from public.providers
      where id = provider_id and profile_id = auth.uid()
    )
  );

-- ==========================================================
-- BREEDING INTENTS (PRD Sección 9)
-- ==========================================================

create policy "Pet owners can view breeding intents for their pets"
  on public.pet_breeding_intents for select
  using (
    exists (
      select 1 from public.pets
      where (id = from_pet_id or id = to_pet_id)
        and owner_id = auth.uid()
    )
  );

create policy "Pet owners can create breeding intents"
  on public.pet_breeding_intents for insert
  with check (
    exists (
      select 1 from public.pets
      where id = from_pet_id and owner_id = auth.uid()
    )
  );

create policy "Target pet owners can update breeding intents"
  on public.pet_breeding_intents for update
  using (
    exists (
      select 1 from public.pets
      where id = to_pet_id and owner_id = auth.uid()
    )
  );

-- ==========================================================
-- WALKS (PRD Sección 12)
-- ==========================================================

create policy "Pet owners can view walks for their pets"
  on public.walks for select
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

create policy "Walkers can view their walks"
  on public.walks for select
  using (
    exists (
      select 1 from public.providers
      where id = walker_id and profile_id = auth.uid()
    )
  );

create policy "Walkers can create walks"
  on public.walks for insert
  with check (
    exists (
      select 1 from public.providers
      where id = walker_id
        and profile_id = auth.uid()
        and service_type = 'walker'
        and active = true
    )
  );

create policy "Walkers can update their walks"
  on public.walks for update
  using (
    exists (
      select 1 from public.providers
      where id = walker_id and profile_id = auth.uid()
    )
  );

-- ==========================================================
-- LOST PET REPORTS (PRD Sección 11)
-- ==========================================================

create policy "Everyone can view active lost pet reports"
  on public.lost_pet_reports for select
  using (not found);

create policy "Users can create lost pet reports"
  on public.lost_pet_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Reporters can update their reports"
  on public.lost_pet_reports for update
  using (auth.uid() = reporter_id);

create policy "Pet owners can update reports about their pets"
  on public.lost_pet_reports for update
  using (
    exists (
      select 1 from public.pets
      where id = pet_id and owner_id = auth.uid()
    )
  );

-- ==========================================================
-- LOST PET IMAGES
-- ==========================================================

create policy "Everyone can view images of active reports"
  on public.lost_pet_images for select
  using (
    exists (
      select 1 from public.lost_pet_reports
      where id = report_id and not found
    )
  );

create policy "Report creators can manage images"
  on public.lost_pet_images for all
  using (
    exists (
      select 1 from public.lost_pet_reports lpr
      where lpr.id = report_id and lpr.reporter_id = auth.uid()
    )
  );

-- ==========================================================
-- CONVERSATIONS & MESSAGES (PRD Sección 13)
-- ==========================================================

create policy "Participants can view conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = id
        and profile_id = auth.uid()
        and not hidden
    )
  );

create policy "Participants can view conversation participants"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_id
        and cp2.profile_id = auth.uid()
    )
  );

create policy "Participants can update their participation"
  on public.conversation_participants for update
  using (auth.uid() = profile_id);

create policy "Participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and profile_id = auth.uid()
        and not hidden
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and profile_id = auth.uid()
    )
  );

create policy "Participants can mark messages as read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id
        and profile_id = auth.uid()
    )
  );

-- ==========================================================
-- NOTIFICATIONS
-- ==========================================================

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = profile_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = profile_id);

create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = profile_id);

-- ==========================================================
-- DEVICE TOKENS
-- ==========================================================

create policy "Users can view own device tokens"
  on public.device_tokens for select
  using (auth.uid() = profile_id);

create policy "Users can manage own device tokens"
  on public.device_tokens for all
  using (auth.uid() = profile_id);

-- ==========================================================
-- PUBLIC READ-ONLY TABLES (sin RLS)
-- ==========================================================

-- Species y Breeds son de solo lectura para todos
alter table public.species disable row level security;
alter table public.breeds disable row level security;
alter table public.vaccines disable row level security;

-- Vistas públicas
-- breeding_public ya es una vista, no necesita RLS
-- calendar_events es una vista que filtra por profile_id

-- Fin de policies
