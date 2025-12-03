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
-- Formato: ARPERJR0000000001 (2 país + 3 especie + 2 raza + 10 dígitos)
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
    lpad(seq::text, 10, '0')
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
    substring(dnia from '.{10}$')::int
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
