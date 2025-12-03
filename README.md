# Animal Humano

Plataforma integral para la gestión y cuidado de mascotas.

## Descripción

Animal Humano es una aplicación web fullstack que permite a los dueños de mascotas gestionar la información de sus animales, encontrar proveedores de servicios, reportar mascotas perdidas, y facilitar cruces entre mascotas compatibles.

## Características Principales

### Gestión de Mascotas
- Registro y administración de mascotas con DNIA único
- Historial de vacunación con recordatorios automáticos
- Registros médicos completos
- Códigos QR para acceso temporal de veterinarios

### Proveedores de Servicios
- Búsqueda geolocalizada de veterinarios, peluquerías, paseadores, etc.
- Sistema de calificaciones y reseñas
- Agendamiento de citas
- Registro de paseos con QR

### Mascotas Perdidas
- Reportes de mascotas perdidas/encontradas
- Búsqueda por proximidad geográfica
- Notificaciones automáticas a usuarios cercanos
- Galería de imágenes

### Sistema de Cruces
- Perfil público de mascotas disponibles para cruce
- Filtros por especie, raza, pedigree
- Sistema de solicitudes y aprobación
- Anti-spam integrado

### Comunicación
- Chat en tiempo real entre usuarios
- Notificaciones push
- Sistema de mensajería para coordinación

## Stack Tecnológico

### Backend
- **Framework**: Flask (Python)
- **Base de Datos**: PostgreSQL (Supabase)
- **Autenticación**: Supabase Auth
- **API**: REST API
- **Geolocalización**: PostGIS (earthdistance)

### Frontend
- **Framework**: Angular 20
- **UI**: Angular Material
- **Estado**: Signals & RxJS
- **Autenticación**: Supabase Client
- **Routing**: Lazy Loading

## Estructura del Proyecto

```
AnimalHumano/
├── backend/                 # API Flask
│   ├── routes/             # Endpoints de la API
│   ├── middleware/         # Auth & Rate limiting
│   ├── config.py           # Configuración Supabase
│   └── requirements.txt    # Dependencias Python
│
├── frontend/               # App Angular
│   ├── src/app/
│   │   ├── core/          # Servicios, modelos, guards
│   │   ├── features/      # Módulos por funcionalidad
│   │   └── shared/        # Componentes compartidos
│   └── package.json       # Dependencias Node
│
└── db/                     # Scripts de base de datos
    ├── COMPLETE_SCHEMA.sql     # Schema completo con RLS
    ├── COMPLETE_SCHEMA_TEST.sql # Schema sin RLS
    ├── 01_core_schema.sql
    ├── 02_breeding_walks.sql
    ├── 03_conversations_notifications.sql
    ├── 04_triggers_functions.sql
    ├── 05_rls_policies.sql
    └── seeds/              # Datos iniciales
```

## Instalación y Configuración

### Requisitos Previos
- Python 3.9+
- Node.js 18+
- PostgreSQL (o cuenta de Supabase)
- Angular CLI 20+

### 1. Configurar Base de Datos

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Ejecutar el schema en el SQL Editor de Supabase:
   ```bash
   # Para desarrollo (sin RLS)
   ejecutar: db/COMPLETE_SCHEMA_TEST.sql

   # Para producción (con RLS)
   ejecutar: db/COMPLETE_SCHEMA.sql
   ```

3. Importar datos seed:
   ```bash
   cd db/seeds
   python import_seeds.py
   ```

### 2. Configurar Backend

1. Instalar dependencias:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Crear archivo `.env`:
   ```env
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   FLASK_SECRET_KEY=tu_secret_key_aqui
   FLASK_DEBUG=True
   CORS_ORIGINS=http://localhost:4200
   PORT=5000
   ```

3. Iniciar el servidor:
   ```bash
   python app.py
   ```

   El servidor estará disponible en `http://localhost:5000`

### 3. Configurar Frontend

1. Instalar dependencias:
   ```bash
   cd frontend
   npm install
   ```

2. Configurar environment (ya configurado en `src/environments/environment.ts`):
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'http://localhost:5000/api',
     supabaseUrl: 'https://tu-proyecto.supabase.co',
     supabaseKey: 'tu_anon_key'
   };
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   ng serve
   ```

   La aplicación estará disponible en `http://localhost:4200`

## Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `PUT /api/auth/profile` - Actualizar perfil

### Mascotas
- `GET /api/pets` - Listar mascotas del usuario
- `POST /api/pets` - Crear mascota
- `GET /api/pets/:id` - Obtener mascota
- `PUT /api/pets/:id` - Actualizar mascota
- `DELETE /api/pets/:id` - Eliminar mascota (soft delete)
- `GET /api/pets/dnia/:dnia` - Buscar por DNIA

### Proveedores
- `GET /api/providers` - Listar proveedores
- `GET /api/providers/search` - Buscar proveedores cercanos
- `GET /api/providers/:id` - Obtener proveedor
- `POST /api/providers/:id/rate` - Calificar proveedor

### Datos Públicos
- `GET /api/data/species` - Listar especies
- `GET /api/data/breeds` - Listar razas
- `GET /api/data/breeds/by-species/:id` - Razas por especie
- `GET /api/data/vaccines` - Listar vacunas
- `GET /api/data/vaccines/by-species/:id` - Vacunas por especie

### Cruces
- `GET /api/breeding` - Listar solicitudes de cruce
- `POST /api/breeding` - Crear solicitud
- `PUT /api/breeding/:id` - Responder solicitud
- `GET /api/breeding/public` - Mascotas disponibles para cruce

### Mascotas Perdidas
- `GET /api/lost-pets` - Listar reportes
- `POST /api/lost-pets` - Crear reporte
- `GET /api/lost-pets/nearby` - Buscar reportes cercanos
- `PUT /api/lost-pets/:id/found` - Marcar como encontrada

### Conversaciones
- `GET /api/conversations` - Listar conversaciones
- `POST /api/conversations` - Crear conversación
- `GET /api/conversations/:id/messages` - Obtener mensajes
- `POST /api/conversations/:id/messages` - Enviar mensaje

### QR
- `POST /api/qr/scan` - Escanear código QR
- `POST /api/qr/generate` - Generar código QR

## Base de Datos

### Tablas Principales
- `profiles` - Usuarios del sistema
- `pets` - Mascotas registradas
- `species` / `breeds` - Especies y razas
- `vaccines` / `pet_vaccinations` - Vacunas y aplicaciones
- `providers` - Proveedores de servicios
- `appointments` - Citas agendadas
- `pet_breeding_intents` - Solicitudes de cruce
- `walks` - Registro de paseos
- `lost_pet_reports` - Reportes de mascotas perdidas
- `conversations` / `messages` - Sistema de chat
- `notifications` - Notificaciones del sistema
- `rate_limits` - Control anti-spam

### Funciones Especiales
- `find_nearby_lost_pets(lat, lng, radius)` - Búsqueda geolocalizada
- `find_nearby_providers(lat, lng, radius, service)` - Proveedores cercanos
- `check_rate_limit(profile_id, action, max, window)` - Validación anti-spam
- `autoclose_walks()` - Cierre automático de paseos >10h

## Seguridad

### Row Level Security (RLS)
El schema incluye políticas RLS completas para:
- Acceso a perfiles propios
- Gestión de mascotas del dueño
- Privacidad en conversaciones
- Acceso temporal vía QR (2 horas)
- Restricciones de administrador

### Rate Limiting
- Mensajes: 20 por hora
- Solicitudes de cruce: 1 cada 7 días
- Reportes de mascotas perdidas: 5 por día
- Calificaciones a proveedores: 1 cada 30 días

## Desarrollo

### Backend
```bash
cd backend
python app.py
```

### Frontend
```bash
cd frontend
ng serve
```

### Build para Producción
```bash
cd frontend
ng build --configuration production
```

## Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
ng test
```

## Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## Licencia

Este proyecto es propietario y confidencial.

## Contacto

Para más información, consultar el PRD completo del proyecto.

---

**Desarrollado con ❤️ para el cuidado de mascotas**
