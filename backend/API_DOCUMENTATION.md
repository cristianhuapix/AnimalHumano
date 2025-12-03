# Animal Humano - API Documentation

## 🔐 Authentication

Todos los endpoints (excepto públicos) requieren header:
```
Authorization: Bearer <token>
```

---

## 📍 Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Registro de usuario | No |
| POST | `/login` | Login | No |
| POST | `/logout` | Logout | Yes |
| GET | `/me` | Obtener perfil actual | Yes |
| PUT | `/me` | Actualizar perfil | Yes |
| POST | `/reset-password` | Reset password | No |
| POST | `/refresh` | Refresh token | No |

### Pets (`/api/pets`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar mascotas (9 por página) | Yes |
| POST | `/` | Crear mascota (DNIA auto) | Yes |
| GET | `/<pet_id>` | Ver mascota | Yes |
| PUT | `/<pet_id>` | Actualizar mascota | Yes |
| DELETE | `/<pet_id>` | Eliminar (soft delete) | Yes |
| GET | `/<pet_id>/vaccinations` | Historial vacunas | Yes |
| POST | `/<pet_id>/vaccinations` | Registrar vacuna | Yes |
| GET | `/<pet_id>/medical-records` | Historial médico | Yes |
| POST | `/<pet_id>/medical-records` | Agregar registro | Yes |

### QR (`/api/qr`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/generate/<pet_id>` | Generar QR | Yes |
| POST | `/scan` | Escanear QR (acceso 2h) | Yes |
| GET | `/verify-access/<pet_id>` | Verificar acceso | Yes |

### Providers (`/api/providers`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Buscar proveedores | No |
| GET | `/nearby` | Proveedores cercanos | No |
| GET | `/<provider_id>` | Ver proveedor | No |
| POST | `/` | Crear perfil proveedor | Yes |
| PUT | `/<provider_id>` | Actualizar proveedor | Yes |
| GET | `/<provider_id>/ratings` | Ver calificaciones | No |
| POST | `/<provider_id>/ratings` | Calificar (1/30 días) | Yes |
| POST | `/<provider_id>/schedules` | Agregar horario | Yes |

### Appointments (`/api/appointments`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar citas | Yes |
| GET | `/calendar` | Vista calendario | Yes |
| POST | `/` | Crear cita | Yes |
| GET | `/<appointment_id>` | Ver cita | Yes |
| PUT | `/<appointment_id>` | Actualizar/cancelar | Yes |
| GET | `/provider` | Citas del proveedor | Yes |

### Breeding (`/api/breeding`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search` | Buscar mascotas | Yes |
| GET | `/intents` | Intenciones recibidas | Yes |
| GET | `/intents/sent` | Intenciones enviadas | Yes |
| POST | `/intents` | Crear intención (1/7 días) | Yes |
| PUT | `/intents/<intent_id>` | Aceptar/rechazar | Yes |

### Walks (`/api/walks`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar paseos (20/página) | Yes |
| POST | `/start` | Iniciar paseo (QR) | Yes |
| POST | `/end` | Finalizar paseo (QR) | Yes |
| GET | `/<walk_id>` | Ver paseo | Yes |
| POST | `/autoclose` | Auto-cierre >10h (cron) | No |
| PUT | `/<walk_id>/notes` | Agregar notas | Yes |

### Lost Pets (`/api/lost-pets`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Buscar perdidas | No |
| GET | `/nearby` | Perdidas cercanas | No |
| POST | `/` | Reportar (5/día) | Yes |
| GET | `/<report_id>` | Ver reporte | No |
| PUT | `/<report_id>` | Actualizar/encontrada | Yes |
| POST | `/<report_id>/images` | Agregar imagen | Yes |

### Conversations (`/api/conversations`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar chats | Yes |
| POST | `/` | Crear chat | Yes |
| GET | `/<conversation_id>/messages` | Ver mensajes | Yes |
| POST | `/<conversation_id>/messages` | Enviar (20/hora) | Yes |
| DELETE | `/<conversation_id>` | Ocultar chat | Yes |

### Notifications (`/api/notifications`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Listar notificaciones | Yes |
| PUT | `/<notification_id>` | Marcar como leída | Yes |
| POST | `/mark-all-read` | Marcar todas leídas | Yes |
| GET | `/settings` | Ver configuración | Yes |
| PUT | `/settings` | Actualizar config | Yes |
| POST | `/device-tokens` | Registrar token FCM/APNs | Yes |
| DELETE | `/device-tokens/<token_id>` | Eliminar token | Yes |

### Admin (`/api/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/metrics` | Métricas dashboard | Admin |
| GET | `/users` | Listar usuarios | Admin |
| PUT | `/users/<user_id>` | Actualizar usuario | Admin |
| GET | `/reports` | Reportes varios | Admin |
| POST | `/verify-license/<provider_id>` | Verificar licencia | Admin |

---

## 🔒 Rate Limits (PRD Section 17)

| Action | Limit |
|--------|-------|
| Mensajes | 20/hora |
| Cruces | 1 cada 7 días |
| Reportes perdidos | 5/día |
| Calificaciones | 1 cada 30 días |

---

## 📝 Response Format

### Success
```json
{
  "data": {},
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error
```json
{
  "error": "Error message",
  "message": "Detailed description"
}
```

---

## 🧪 Testing

```bash
# Test authentication
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test with auth
curl http://localhost:5000/api/pets \
  -H "Authorization: Bearer <token>"
```

---

## 📚 Notas

- Todos los timestamps en UTC
- Paginación default: 20 items
- Max page size: 100 items
- DNIA auto-generado en creación de mascota
- Especie/raza inmutables (enforced por DB)
- Soft delete en mascotas (is_deleted=true)
