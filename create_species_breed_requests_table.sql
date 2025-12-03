-- ==========================================================
-- TABLA PARA SOLICITUDES DE ESPECIES Y RAZAS
-- Permite a los usuarios solicitar nuevas especies/razas
-- que no están en el sistema
-- ==========================================================

create table if not exists public.species_breed_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.profiles(id) on delete cascade not null,
  request_type text not null check (request_type in ('species', 'breed')),

  -- Para solicitudes de especie
  species_name text,

  -- Para solicitudes de raza
  breed_name text,
  species_id uuid references public.species(id) on delete set null,

  -- Control
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text, -- Notas del administrador

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  constraint species_or_breed_required check (
    (request_type = 'species' and species_name is not null) or
    (request_type = 'breed' and breed_name is not null and species_id is not null)
  )
);

-- Índices
create index idx_species_breed_requests_user on public.species_breed_requests(requested_by);
create index idx_species_breed_requests_status on public.species_breed_requests(status);
create index idx_species_breed_requests_type on public.species_breed_requests(request_type);

-- RLS
alter table public.species_breed_requests enable row level security;

-- Los usuarios pueden ver sus propias solicitudes
create policy "Users can view their own requests"
  on public.species_breed_requests
  for select
  using (auth.uid() = requested_by);

-- Los usuarios pueden crear solicitudes
create policy "Users can create requests"
  on public.species_breed_requests
  for insert
  with check (auth.uid() = requested_by);

-- Trigger para updated_at
create trigger trg_species_breed_requests_updated_at
  before update on public.species_breed_requests
  for each row
  execute function public.update_updated_at();

-- Comentarios
comment on table public.species_breed_requests is 'Solicitudes de usuarios para agregar nuevas especies o razas al sistema';
comment on column public.species_breed_requests.request_type is 'Tipo de solicitud: species o breed';
comment on column public.species_breed_requests.status is 'Estado de la solicitud: pending, approved, rejected';
