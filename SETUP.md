# Animal Humano - Setup Completo

## 🎯 Resumen

Base de datos completa basada en PRD v1 con:
- ✅ Todas las tablas del PRD
- ✅ QR Scans con acceso temporal (2h veterinarios)
- ✅ Rate limiting (anti-spam)
- ✅ Calificaciones proveedores (1 cada 30 días)
- ✅ Configuración de notificaciones
- ✅ Monetización (plan_fee)
- ✅ Vista unificada calendario
- ✅ RLS policies completas
- ✅ Triggers y funciones según PRD

---

## 📦 Estructura del Proyecto

```
AnimalHumano/
├── db/
│   ├── 01_core_schema.sql           # Tablas principales
│   ├── 02_breeding_walks.sql        # Cruces y paseos
│   ├── 03_conversations_notifications.sql  # Chats y notificaciones
│   ├── 04_triggers_functions.sql    # Triggers y funciones
│   ├── 05_rls_policies.sql          # Políticas de seguridad
│   ├── install_all.sql              # Script unificado
│   └── seeds/
│       ├── species.csv
│       ├── breeds.csv
│       ├── vaccines.csv
│       └── import_seeds.py
├── backend/                         # Flask BFF (próximo paso)
├── frontend/                        # Angular + Capacitor (próximo paso)
├── .env
├── PRD.md
└── SETUP.md (este archivo)
```

---

## 🚀 Instalación Paso a Paso

### 1. Configurar Variables de Entorno

Tu `.env` ya está configurado con:
```bash
SUPABASE_URL=https://nbuqowkkvmzzvgdxrzkm.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 2. Ejecutar Scripts SQL en Supabase

Ve a: **https://supabase.com/dashboard/project/nbuqowkkvmzzvgdxrzkm/sql/new**

**Opción A: Manual (Recomendado)**

Copia y pega cada archivo en orden:

1. `db/01_core_schema.sql`
2. `db/02_breeding_walks.sql`
3. `db/03_conversations_notifications.sql`
4. `db/04_triggers_functions.sql`
5. `db/05_rls_policies.sql`

**Opción B: Script Unificado**

Copia y pega todo el contenido combinado de los 5 archivos.

### 3. Importar Datos Seed

```bash
cd db
python seeds/import_seeds.py
```

Esto importará:
- 10 especies
- 70+ razas
- 19 vacunas

### 4. Verificar Instalación

```python
python test_connection.py
```

Deberías ver:
```
Conectando a: https://nbuqowkkvmzzvgdxrzkm.supabase.co
Conexion exitosa!
...
```

---

## 📋 Tablas Creadas

### Core
- `profiles` - Usuarios (dueños/proveedores/admins)
- `notification_settings` - Configuración de notificaciones por usuario
- `species` - Especies (Perro, Gato, etc.)
- `breeds` - Razas por especie
- `pets` - Mascotas con DNIA auto-generado

### QR & Acceso
- `pet_qr_codes` - Códigos QR por mascota
- `qr_scans` - Registro de escaneos con acceso temporal

### Salud
- `vaccines` - Catálogo de vacunas
- `pet_vaccinations` - Vacunas aplicadas
- `medical_records` - Historial médico

### Proveedores
- `providers` - Proveedores de servicios
- `provider_ratings` - Calificaciones (max 1 cada 30 días)
- `availability_schedules` - Horarios de atención
- `appointments` - Citas agendadas

### Cruces & Paseos
- `pet_breeding_intents` - Intenciones de cruce
- `walks` - Paseos con auto-cierre 10h

### Mascotas Perdidas
- `lost_pet_reports` - Reportes de mascotas perdidas
- `lost_pet_images` - Imágenes de reportes

### Comunicación
- `conversations` - Conversaciones
- `conversation_participants` - Participantes
- `messages` - Mensajes
- `rate_limits` - Control anti-spam

### Notificaciones
- `notifications` - Notificaciones push
- `device_tokens` - Tokens FCM/APNs

---

## 🔍 Funciones Principales

### DNIA Generation
```sql
-- Se genera automáticamente al insertar mascota
-- Formato: ARPERJR0000001 (País + Especie + Raza + Secuencia)
```

### QR Access Control
```sql
select public.has_qr_access('pet_id', 'profile_id');
-- Verifica si usuario tiene acceso temporal (2h) a mascota
```

### Start/End Walks
```sql
select public.start_walk('pet_id', 'walker_id', 'qr_code');
select public.end_walk('walk_id', 'qr_code');
```

### Auto-close Walks (ejecutar cada hora vía cron)
```sql
select public.autoclose_walks();
-- Cierra paseos de más de 10h automáticamente
```

### Find Nearby Lost Pets
```sql
select * from public.find_nearby_lost_pets(-34.6037, -58.3816, 10);
-- Busca mascotas perdidas en radio de 10km
```

### Find Nearby Providers
```sql
select * from public.find_nearby_providers(-34.6037, -58.3816, 5, 'veterinarian');
-- Busca veterinarios en radio de 5km
```

### Validate Breeding Compatibility
```sql
select * from public.validate_breeding_compatibility('pet1_id', 'pet2_id');
-- Valida si dos mascotas pueden cruzarse
```

### Rate Limiting
```sql
select public.check_rate_limit('profile_id', 'message', 20, '1 hour');
-- Verifica límite de 20 mensajes por hora
```

---

## 🔒 Seguridad (RLS)

Todas las tablas tienen RLS activo con políticas según PRD:

- ✅ Usuarios solo ven sus propios datos
- ✅ Veterinarios acceden con QR temporal (2h)
- ✅ Proveedores no pueden iniciar chats
- ✅ Validación de rate limits
- ✅ Soft delete obligatorio en mascotas

---

## 📅 Vista de Calendario

```sql
select * from public.calendar_events
where profile_id = 'user_id'
and event_date >= current_date
order by event_date;
```

Colores:
- 🔵 Azul → Citas
- 🔴 Rojo → Vacunas obligatorias
- 🟡 Amarillo → Vacunas opcionales

---

## ⚡ Rate Limits (Anti-Spam)

Según PRD Sección 17:
- 📨 Mensajes: 20/hora
- 🐾 Cruces: 1 cada 7 días
- 📢 Reportes perdidos: 5/día
- ⭐ Calificaciones: 1 cada 30 días

---

## 🧪 Próximos Pasos

1. ✅ Base de datos completa
2. ⏳ Backend Flask con endpoints según PRD
3. ⏳ Frontend Angular + Capacitor
4. ⏳ Tests API (pytest)
5. ⏳ Tests DB (psql)
6. ⏳ i18n (ES/EN/PT)
7. ⏳ Push notifications (FCM/APNs)

---

## 📝 Notas Importantes

### DNIA
- Se genera automáticamente
- Formato: `ARPERJR0000001`
- NO editable

### Especie & Raza
- **INMUTABLES** una vez creada la mascota
- Trigger previene cambios

### Mascotas
- **Soft delete** obligatorio (is_deleted=true)
- NO se pueden eliminar físicamente

### Proveedores
- No pueden iniciar chats (solo responder)
- Calificaciones: máx 1 cada 30 días

### Paseos
- Auto-cierre a las 10 horas
- Requieren scan QR inicio y fin

---

## 🐛 Troubleshooting

### Error: "permission denied"
- Verifica que RLS esté configurado
- Usa SERVICE_ROLE_KEY para operaciones admin

### Error en DNIA
- Verifica que `country` en profile esté configurado
- Chequea que species y breeds tengan códigos

### Error en geolocalización
- Asegúrate que `earthdistance` extension esté habilitada
- Verifica que providers tengan latitude/longitude

---

## 📚 Referencias

- **PRD**: `PRD.md`
- **Supabase Dashboard**: https://supabase.com/dashboard/project/nbuqowkkvmzzvgdxrzkm
- **SQL Editor**: https://supabase.com/dashboard/project/nbuqowkkvmzzvgdxrzkm/sql/new

---

**¿Todo listo?** Ahora podemos avanzar con:
- Backend Flask
- Frontend Angular
- Tests

¿Por dónde querés que sigamos?
