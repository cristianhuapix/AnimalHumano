# Animal Humano - Backend Flask (BFF)

Backend API basado en PRD v1.

## 📁 Estructura

```
backend/
├── app.py                  # Main application
├── config.py               # Configuration & Supabase clients
├── requirements.txt        # Python dependencies
├── middleware/
│   ├── auth.py            # JWT authentication
│   └── rate_limit.py      # Anti-spam rate limiting
├── routes/
│   ├── auth.py            # Authentication endpoints
│   ├── pets.py            # Pet management
│   ├── providers.py       # Provider search & management
│   ├── appointments.py    # Appointments
│   ├── breeding.py        # Breeding intents
│   ├── walks.py           # Dog walks
│   ├── lost_pets.py       # Lost pets reports
│   ├── conversations.py   # Chats & messages
│   ├── notifications.py   # Push notifications
│   ├── qr.py              # QR code scanning
│   └── admin.py           # Admin dashboard
└── README.md              # This file
```

## 🚀 Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Asegúrate que `.env` en la raíz del proyecto tenga:

```bash
SUPABASE_URL=https://nbuqowkkvmzzvgdxrzkm.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FLASK_SECRET_KEY=your_secret_key
FLASK_DEBUG=True
CORS_ORIGINS=http://localhost:4200
```

### 3. Run Server

```bash
python app.py
```

Server estará en: `http://localhost:5000`

## 📋 Endpoints Implementados

### Authentication (`/api/auth`)
- `POST /register` - Registro de usuario
- `POST /login` - Login
- `POST /logout` - Logout
- `GET /me` - Obtener perfil actual
- `PUT /me` - Actualizar perfil
- `POST /reset-password` - Reset password
- `POST /refresh` - Refresh token

### Pets (`/api/pets`)
- `GET /` - Listar mascotas (paginado 9 items)
- `POST /` - Crear mascota (DNIA auto-generado)
- `GET /<pet_id>` - Ver mascota
- `PUT /<pet_id>` - Actualizar mascota
- `DELETE /<pet_id>` - Eliminar (soft delete)
- `GET /<pet_id>/vaccinations` - Historial vacunas
- `POST /<pet_id>/vaccinations` - Registrar vacuna
- `GET /<pet_id>/medical-records` - Historial médico
- `POST /<pet_id>/medical-records` - Agregar registro médico

### QR (`/api/qr`)
- `POST /generate/<pet_id>` - Generar QR para mascota
- `POST /scan` - Escanear QR (acceso temporal 2h)
- `GET /verify-access/<pet_id>` - Verificar acceso

### Providers (`/api/providers`)
- `GET /` - Buscar proveedores (con filtros)
- `GET /nearby` - Proveedores cercanos (geolocalización)
- `POST /` - Crear perfil de proveedor
- `GET /<provider_id>` - Ver proveedor
- `POST /<provider_id>/ratings` - Calificar (1 cada 30 días)

### Appointments (`/api/appointments`)
- `GET /` - Listar citas
- `POST /` - Agendar cita
- `PUT /<appointment_id>` - Actualizar/cancelar

### Breeding (`/api/breeding`)
- `GET /search` - Buscar mascotas para cruce
- `POST /intents` - Enviar intención de cruce (1 cada 7 días)
- `GET /intents` - Ver intenciones recibidas
- `PUT /intents/<intent_id>` - Aceptar/rechazar

### Walks (`/api/walks`)
- `POST /start` - Iniciar paseo (scan QR)
- `POST /end` - Finalizar paseo (scan QR)
- `GET /` - Listar paseos
- `POST /autoclose` - Cerrar paseos >10h (cron job)

### Lost Pets (`/api/lost-pets`)
- `GET /` - Buscar mascotas perdidas (público)
- `GET /nearby` - Mascotas perdidas cercanas
- `POST /` - Reportar mascota perdida (máx 5/día)
- `PUT /<report_id>` - Marcar como encontrada

### Conversations (`/api/conversations`)
- `GET /` - Listar chats
- `POST /` - Iniciar chat (solo usuarios, no proveedores)
- `GET /<conversation_id>/messages` - Ver mensajes
- `POST /<conversation_id>/messages` - Enviar mensaje (máx 20/hora)

### Notifications (`/api/notifications`)
- `GET /` - Listar notificaciones
- `PUT /<notification_id>` - Marcar como leída
- `PUT /settings` - Configurar notificaciones

### Admin (`/api/admin`)
- `GET /metrics` - Métricas del dashboard
- `GET /users` - Listar usuarios
- `GET /reports` - Reportes

## 🔒 Seguridad

### Authentication
- JWT tokens vía Supabase Auth
- Middleware valida token en cada request
- Excepto endpoints públicos (login, register, search providers, etc.)

### Rate Limiting (PRD Section 17)
- **Mensajes**: 20/hora
- **Cruces**: 1 cada 7 días
- **Reportes perdidos**: 5/día
- **Calificaciones**: 1 cada 30 días

### RLS
- Todas las queries usan las policies de Supabase
- Users solo acceden a sus propios datos
- Vets acceden vía QR temporal (2h)

## 🧪 Testing

```bash
pytest
```

## 📝 Próximos Pasos

1. ✅ Estructura base y auth
2. ✅ Pets, QR, vacunas
3. ⏳ Providers completo
4. ⏳ Appointments
5. ⏳ Breeding
6. ⏳ Walks
7. ⏳ Lost Pets
8. ⏳ Conversations
9. ⏳ Notifications
10. ⏳ Admin

## 🐛 Debug

Logs en consola cuando `FLASK_DEBUG=True`

Endpoints de test:
- `GET /health` - Health check
- `GET /` - API info
