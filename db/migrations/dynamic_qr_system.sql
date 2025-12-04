-- ==========================================================
-- MIGRACIÓN: Sistema de QR Dinámico
-- Fecha: 2024-12-03
-- Descripción:
--   - QR codes dinámicos que cambian después de cada uso
--   - Un solo uso por QR (se invalida inmediatamente al escanear)
--   - Sin restricción de tiempo entre escaneos
-- ==========================================================

-- 1. Agregar columna 'used_at' a pet_qr_codes para marcar cuando fue usado
ALTER TABLE public.pet_qr_codes
ADD COLUMN IF NOT EXISTS used_at timestamptz DEFAULT NULL;

-- 2. Agregar columna 'used_by' para saber quién lo usó
ALTER TABLE public.pet_qr_codes
ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Crear función para generar nuevo QR dinámico
CREATE OR REPLACE FUNCTION public.generate_dynamic_qr(p_pet_id uuid)
RETURNS TABLE(qr_code text, qr_id uuid) AS $$
DECLARE
  v_new_qr_code text;
  v_new_qr_id uuid;
BEGIN
  -- Desactivar todos los QR anteriores de esta mascota
  UPDATE public.pet_qr_codes
  SET is_active = false
  WHERE pet_id = p_pet_id AND is_active = true;

  -- Generar nuevo código único (UUID + timestamp para mayor seguridad)
  v_new_qr_code := encode(gen_random_bytes(32), 'hex');

  -- Insertar nuevo QR activo
  INSERT INTO public.pet_qr_codes (pet_id, qr_code, is_active, expires_at)
  VALUES (p_pet_id, v_new_qr_code, true, now() + interval '24 hours')
  RETURNING id, pet_qr_codes.qr_code INTO v_new_qr_id, v_new_qr_code;

  RETURN QUERY SELECT v_new_qr_code, v_new_qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Actualizar función start_walk para usar QR de un solo uso
CREATE OR REPLACE FUNCTION public.start_walk(
  p_pet_id uuid,
  p_walker_id uuid,
  p_qr_code text
)
RETURNS uuid AS $$
DECLARE
  v_walk_id uuid;
  v_qr_id uuid;
  v_qr_valid boolean;
  v_provider_is_walker boolean;
  v_walker_profile_id uuid;
BEGIN
  -- Validar QR code (debe estar activo, no usado, y no expirado)
  SELECT id INTO v_qr_id
  FROM public.pet_qr_codes
  WHERE pet_id = p_pet_id
    AND qr_code = p_qr_code
    AND is_active = true
    AND used_at IS NULL  -- No usado
    AND (expires_at IS NULL OR expires_at > now());

  IF v_qr_id IS NULL THEN
    RAISE EXCEPTION 'QR code inválido, ya usado o expirado';
  END IF;

  -- Verificar que sea paseador activo
  SELECT EXISTS(
    SELECT 1 FROM public.providers
    WHERE id = p_walker_id
      AND service_type = 'walker'
      AND active = true
  ) INTO v_provider_is_walker;

  IF NOT v_provider_is_walker THEN
    RAISE EXCEPTION 'Solo paseadores pueden iniciar paseos';
  END IF;

  -- Obtener profile_id del paseador
  SELECT profile_id INTO v_walker_profile_id
  FROM public.providers
  WHERE id = p_walker_id;

  -- Verificar que no haya un paseo activo para esta mascota
  IF EXISTS(
    SELECT 1 FROM public.walks
    WHERE pet_id = p_pet_id
      AND pickup_scanned_at IS NOT NULL
      AND dropoff_scanned_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya existe un paseo activo para esta mascota';
  END IF;

  -- Marcar QR como usado (un solo uso)
  UPDATE public.pet_qr_codes
  SET used_at = now(),
      used_by = v_walker_profile_id,
      is_active = false
  WHERE id = v_qr_id;

  -- Registrar scan del QR
  INSERT INTO public.qr_scans (pet_id, scanned_by, qr_code, scan_type)
  VALUES (p_pet_id, v_walker_profile_id, p_qr_code, 'walk_start');

  -- Crear paseo
  INSERT INTO public.walks (pet_id, walker_id, pickup_scanned_at)
  VALUES (p_pet_id, p_walker_id, now())
  RETURNING id INTO v_walk_id;

  RETURN v_walk_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Actualizar función end_walk (también usa QR de un solo uso)
CREATE OR REPLACE FUNCTION public.end_walk(
  p_walk_id uuid,
  p_qr_code text
)
RETURNS boolean AS $$
DECLARE
  v_pet_id uuid;
  v_walker_profile_id uuid;
  v_qr_id uuid;
BEGIN
  -- Obtener datos del paseo
  SELECT w.pet_id, prov.profile_id INTO v_pet_id, v_walker_profile_id
  FROM public.walks w
  JOIN public.providers prov ON prov.id = w.walker_id
  WHERE w.id = p_walk_id
    AND w.pickup_scanned_at IS NOT NULL
    AND w.dropoff_scanned_at IS NULL;

  IF v_pet_id IS NULL THEN
    RAISE EXCEPTION 'Paseo no encontrado o ya finalizado';
  END IF;

  -- Validar QR code (debe estar activo, no usado, y no expirado)
  SELECT id INTO v_qr_id
  FROM public.pet_qr_codes
  WHERE pet_id = v_pet_id
    AND qr_code = p_qr_code
    AND is_active = true
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_qr_id IS NULL THEN
    RAISE EXCEPTION 'QR code inválido, ya usado o expirado';
  END IF;

  -- Marcar QR como usado
  UPDATE public.pet_qr_codes
  SET used_at = now(),
      used_by = v_walker_profile_id,
      is_active = false
  WHERE id = v_qr_id;

  -- Registrar scan
  INSERT INTO public.qr_scans (pet_id, scanned_by, qr_code, scan_type)
  VALUES (v_pet_id, v_walker_profile_id, p_qr_code, 'walk_end');

  -- Finalizar paseo
  UPDATE public.walks
  SET dropoff_scanned_at = now()
  WHERE id = p_walk_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Función para validar y usar QR genérico (para otros servicios)
CREATE OR REPLACE FUNCTION public.validate_and_use_qr(
  p_pet_id uuid,
  p_qr_code text,
  p_scanned_by uuid,
  p_scan_type text DEFAULT 'general'
)
RETURNS TABLE(valid boolean, pet_name text, qr_id uuid) AS $$
DECLARE
  v_qr_id uuid;
  v_pet_name text;
BEGIN
  -- Validar QR code
  SELECT pqc.id INTO v_qr_id
  FROM public.pet_qr_codes pqc
  WHERE pqc.pet_id = p_pet_id
    AND pqc.qr_code = p_qr_code
    AND pqc.is_active = true
    AND pqc.used_at IS NULL
    AND (pqc.expires_at IS NULL OR pqc.expires_at > now());

  IF v_qr_id IS NULL THEN
    RETURN QUERY SELECT false, ''::text, NULL::uuid;
    RETURN;
  END IF;

  -- Obtener nombre de la mascota
  SELECT p.name INTO v_pet_name
  FROM public.pets p
  WHERE p.id = p_pet_id;

  -- Marcar QR como usado
  UPDATE public.pet_qr_codes
  SET used_at = now(),
      used_by = p_scanned_by,
      is_active = false
  WHERE id = v_qr_id;

  -- Registrar scan
  INSERT INTO public.qr_scans (pet_id, scanned_by, qr_code, scan_type)
  VALUES (p_pet_id, p_scanned_by, p_qr_code, p_scan_type);

  RETURN QUERY SELECT true, v_pet_name, v_qr_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función para obtener el QR activo actual de una mascota
CREATE OR REPLACE FUNCTION public.get_active_qr(p_pet_id uuid)
RETURNS TABLE(qr_code text, qr_id uuid, expires_at timestamptz, created_at timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT pqc.qr_code, pqc.id, pqc.expires_at, pqc.created_at
  FROM public.pet_qr_codes pqc
  WHERE pqc.pet_id = p_pet_id
    AND pqc.is_active = true
    AND pqc.used_at IS NULL
    AND (pqc.expires_at IS NULL OR pqc.expires_at > now())
  ORDER BY pqc.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Índice para búsqueda rápida de QR activos
CREATE INDEX IF NOT EXISTS idx_pet_qr_codes_active_unused
ON public.pet_qr_codes(pet_id, is_active, used_at)
WHERE is_active = true AND used_at IS NULL;

-- 9. Limpiar QR codes expirados (para ejecutar periódicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_qr_codes()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.pet_qr_codes
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
