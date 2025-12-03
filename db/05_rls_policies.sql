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
