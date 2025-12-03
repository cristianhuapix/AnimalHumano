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
create index idx_messages_unread on public.messages(conversation_id) ;

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
create index idx_notifications_unread on public.notifications(profile_id)
  ;

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

create index idx_device_tokens_profile on public.device_tokens(profile_id) ;

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
