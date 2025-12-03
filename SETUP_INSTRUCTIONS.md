# Animal Humano - Instrucciones de Configuración

## 🔧 Setup Base de Datos en Supabase

### Paso 1: Crear Proyecto en Supabase
1. Ve a https://supabase.com y crea una cuenta
2. Crea un nuevo proyecto
3. Guarda tu **SUPABASE_URL** y **SUPABASE_ANON_KEY** (Project Settings → API)

Tu URL será: `https://nbuqowkkvmzzvgdxrzkm.supabase.co`

### Paso 2: Ejecutar Scripts SQL (EN ORDEN)

Ve a **SQL Editor** en Supabase y ejecuta los archivos en este orden:

#### 1️⃣ Schema Base
```sql
-- Ejecutar: animal_humano_schema.sql
```
Esto crea todas las tablas base, índices, triggers y políticas RLS.

#### 2️⃣ Breeding/Cruces
```sql
-- Ejecutar: animal_humano_breeding_patch_v2.sql
```
Agrega funcionalidad de cruces entre mascotas.

#### 3️⃣ DNIA, Maps y Walks
```sql
-- Ejecutar: animal_humano_patch_dnia_maps_walks.sql
```
Agrega generación de DNIA, funciones de geolocalización y gestión de paseos.

#### 4️⃣ Inmutabilidad y Auditoría
```sql
-- Ejecutar: sql_patch_immutability.sql
```
Agrega protecciones de inmutabilidad y sistema de transferencia de mascotas.

#### 5️⃣ Reglas de Vacunas (Opcional)
```sql
-- Ejecutar: vaccine_rules_patch.sql
```
Agrega tabla para reglas de vacunación por país.

### Paso 3: Importar Datos Seed

Ve a **Table Editor** en Supabase:

#### Importar Species
1. Selecciona la tabla `species`
2. Click en "Insert" → "Import from CSV"
3. Sube `seed_species.csv`
4. Mapea columna: `name` → `name`
5. Deja que Supabase genere los UUIDs automáticamente

#### Importar Breeds
1. Selecciona la tabla `breeds`
2. Click en "Insert" → "Import from CSV"
3. Sube `seed_breeds.csv`
4. **IMPORTANTE**: Necesitarás hacer un script para relacionar `species_name` con el UUID real

**Opción A - Script SQL manual:**
```sql
-- Crear tabla temporal
create temp table breeds_temp (
  species_name text,
  breed_name text
);

-- Copiar datos del CSV (usa el Table Editor para importar a breeds_temp)
-- Luego insertar con joins:
insert into public.breeds (species_id, name)
select s.id, bt.breed_name
from breeds_temp bt
join public.species s on s.name = bt.species_name;
```

**Opción B - Script Python:**
```python
# seed_breeds.py
from supabase import create_client
import csv

supabase = create_client(
    "https://nbuqowkkvmzzvgdxrzkm.supabase.co",
    "YOUR_SERVICE_ROLE_KEY"  # Usar service role para admin
)

# Obtener species
species = {s['name']: s['id'] for s in supabase.table('species').select('*').execute().data}

# Leer CSV
with open('seed_breeds.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        species_id = species.get(row['species_name'])
        if species_id:
            supabase.table('breeds').insert({
                'species_id': species_id,
                'name': row['name']
            }).execute()
```

#### Importar Vaccines
Similar al proceso de breeds:

```python
# seed_vaccines.py
from supabase import create_client
import csv

supabase = create_client(
    "https://nbuqowkkvmzzvgdxrzkm.supabase.co",
    "YOUR_SERVICE_ROLE_KEY"
)

species = {s['name']: s['id'] for s in supabase.table('species').select('*').execute().data}

with open('seed_vaccines.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        species_id = species.get(row['species_name'])
        if species_id:
            supabase.table('vaccines').insert({
                'species_id': species_id,
                'name': row['name'],
                'required': row['required'].lower() == 'true',
                'description': row['description'],
                'interval_days': int(row['interval_days']) if row['interval_days'] else None,
                'contagious_to_humans': row['contagious_to_humans'].lower() == 'true'
            }).execute()
```

### Paso 4: Configurar Autenticación

En Supabase → **Authentication** → **Providers**:
1. Habilita Email/Password
2. Opcional: Habilita Google, Apple, etc.

### Paso 5: Verificar RLS

Ve a **Table Editor** → selecciona una tabla → pestaña "Policies"

Verifica que las políticas RLS estén activas. Las principales ya vienen configuradas en los scripts SQL.

## 🔐 Variables de Entorno

### Backend (Flask)
```bash
export SUPABASE_URL="https://nbuqowkkvmzzvgdxrzkm.supabase.co"
export SUPABASE_ANON_KEY="eyJ..."
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # Solo para operaciones admin
export MAPS_API_KEY="..."  # Google Maps
export FCM_SERVER_KEY="..."  # Firebase Cloud Messaging
```

### Frontend (Angular)
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  supabaseUrl: 'https://nbuqowkkvmzzvgdxrzkm.supabase.co',
  supabaseAnonKey: 'eyJ...',
  mapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY',
  i18nDefault: 'es',
};
```

## 🧪 Pruebas

### Probar conexión desde Python
```python
from supabase import create_client

supabase = create_client(
    "https://nbuqowkkvmzzvgdxrzkm.supabase.co",
    "YOUR_ANON_KEY"
)

# Test query
result = supabase.table('species').select('*').execute()
print(result.data)
```

### Probar desde TypeScript
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nbuqowkkvmzzvgdxrzkm.supabase.co',
  'YOUR_ANON_KEY'
);

// Test query
const { data, error } = await supabase.from('species').select('*');
console.log(data);
```

## 📊 Funciones Útiles Disponibles

### Búsqueda de mascotas perdidas cercanas
```sql
select * from public.find_nearby_lost_pets(
  -34.6037,  -- latitude
  -58.3816,  -- longitude (Buenos Aires)
  10         -- radio en km
);
```

### Búsqueda de proveedores cercanos
```sql
select * from public.find_nearby_providers(
  -34.6037,
  -58.3816,
  5,
  'veterinarian'  -- tipo de servicio
);
```

### Validar compatibilidad de cruce
```sql
select * from public.validate_breeding_compatibility(
  'pet1-uuid',
  'pet2-uuid'
);
```

### Cierre automático de paseos
```sql
-- Ejecutar periódicamente (ej. cada hora via cron job)
select public.autoclose_walks();
```

## 🔄 Mantenimiento

### Backup
Supabase hace backups automáticos, pero puedes exportar manualmente:
- Project Settings → Database → Database Backups

### Logs
- Dashboard → Logs Explorer

### Métricas
- Dashboard → Database → Usage

## ⚠️ Notas Importantes

1. **Zona Horaria**: Toda la DB usa UTC. Convertir en cliente.
2. **DNIA**: Se genera automáticamente al insertar mascota.
3. **Inmutabilidad**: Especie y raza NO se pueden cambiar después de crear mascota.
4. **Transferencias**: Usa `public.transfer_pet()` para cambiar dueño.
5. **Soft Delete**: Las mascotas no se eliminan físicamente, usa `is_deleted = true`.

## 🐛 Troubleshooting

### Error: "permission denied for table"
- Verifica que las políticas RLS estén activas
- Usa `SUPABASE_SERVICE_ROLE_KEY` para operaciones admin

### Error en DNIA generation
- Verifica que el profile tenga el campo `country` relleno
- Chequea que species y breeds existan

### Error en geolocalización
- Asegúrate de que `earthdistance` extension esté habilitada:
```sql
create extension if not exists earthdistance cascade;
```

## 📚 Próximos Pasos

1. Configurar backend Flask con los endpoints
2. Configurar frontend Angular con Supabase client
3. Implementar notificaciones push (FCM)
4. Configurar i18n (ES/EN/PT)
5. Desarrollar app móvil con Capacitor

## 🤝 Soporte

Para issues: https://github.com/tu-repo/animal-humano/issues
