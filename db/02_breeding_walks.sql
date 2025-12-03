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

create index idx_lost_pet_reports_pet on public.lost_pet_reports(pet_id) ;
create index idx_lost_pet_reports_reporter on public.lost_pet_reports(reporter_id);
create index idx_lost_pet_reports_active on public.lost_pet_reports(species_id, breed_id, created_at desc)
  ;
-- Note: earthdistance ll_to_earth() is not IMMUTABLE, using btree on lat/long instead
create index idx_lost_pet_reports_latitude on public.lost_pet_reports(latitude) ;
create index idx_lost_pet_reports_longitude on public.lost_pet_reports(longitude) ;

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
