
# Local Dev (Supabase Web, sin Docker)

Este proyecto está pensado para usar **Supabase gestionado (web)**, no self-hosted.
Claude Code puede leer este archivo para preparar el entorno de desarrollo.

## Requisitos
- Cuenta en **Supabase** y un **Proyecto** creado.
- **SUPABASE_URL** y **SUPABASE_ANON_KEY** (desde Project Settings → API).
- **Node 20+** (frontend Angular), **Python 3.11+** (Flask BFF).
- Claves opcionales: **Google Maps API key**, **FCM server key** para push.

## Pasos
1. **Base de datos (Supabase)**
   - En el panel de Supabase → **SQL Editor**:
     1) Ejecutá `animal_humano_schema.sql`
     2) Ejecutá `animal_humano_breeding_patch_v2.sql`
     3) Ejecutá `animal_humano_patch_dnia_maps_walks.sql`
     4) Ejecutá `sql_patch_immutability.sql`
     5) (Opcional) `vaccine_rules_patch.sql`
   - Importá los CSV (`seed_species.csv`, `seed_breeds.csv`, `seed_vaccines.csv`) desde **Table Editor**.
   - Verificá **RLS** y **Policies** creadas (ya vienen en los .sql).

2. **Backend (Flask BFF)**
   - Variables de entorno:
     ```bash
     export SUPABASE_URL="https://xxxx.supabase.co"
     export SUPABASE_ANON_KEY="eyJ..."
     export SUPABASE_SERVICE_ROLE=""   # opcional para jobs/administrativas
     export MAPS_API_KEY=""            # opcional
     export FCM_SERVER_KEY=""          # opcional (push)
     ```
   - Estructurá endpoints según el PRD (Claude Code puede generarlos).

3. **Frontend (Angular + Capacitor)**
   - Configurar `environment.ts` con:
     ```ts
     export const environment = {
       production: false,
       supabaseUrl: 'https://xxxx.supabase.co',
       supabaseAnonKey: 'eyJ...',
       mapsApiKey: '',
       i18nDefault: 'es',
     };
     ```
   - Asegurá i18n (ngx-translate) con **ES/EN/PT** incluídos (`/i18n`).

4. **Push Notifications**
   - iOS/Android: Capacitor + FCM/APNs. Web: FCM + Service Worker.
   - Registrar tokens en `device_tokens`.

5. **Pruebas**
   - **API (pytest)**: ver `tests/api/test_endpoints.py` (Claude debe completar los llamados reales).
   - **DB (psql)**: `tests/db/test_sql_functions.sql` (editar UUIDs de ejemplo).

## Notas
- Mantener todo en **UTC** en DB.
- El **DNIA** se genera automáticamente en el `INSERT` de `pets` (ver triggers).
- Especie/raza son **inmutables** (trigger de bloqueo).
