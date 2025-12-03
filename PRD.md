# PRD — Animal Humano (v1)
Plataforma híbrida web + móvil

**Stack:** Angular + Capacitor / Flask + Supabase
**Idiomas:** Español, Inglés, Portugués
**Target:** Dueños de mascotas y proveedores de servicios pet (veterinarios, paseadores, petshops, guarderías, etc.)

---

## 🔹 1. Objetivo general

Conectar a dueños de mascotas con proveedores de servicios del ecosistema animal (veterinarios, paseadores, petshops, refugios, etc.) y permitir la gestión integral de cada mascota: vacunas, historial médico, paseos, citas, mascotas perdidas, cruces y comunicación entre usuarios.

---

## 🔹 2. Roles de usuario

| Rol | Descripción |
|-----|-------------|
| **Usuario (Dueño)** | Administra sus mascotas, vacunas, historial, citas, notificaciones, chats y publicaciones. |
| **Proveedor** | Ofrece servicios (veterinarios, paseadores, petshops, etc.) y recibe contactos de usuarios. |
| **Veterinario** | Accede temporalmente (2h) al historial médico y vacunas de mascotas al escanear el QR. |
| **Paseador** | Escanea el QR para marcar inicio y fin de paseo (autocierre a las 10h). |
| **Administrador** | Supervisa métricas globales, usuarios, mascotas, facturación, publicaciones y permisos. |

---

## 🔹 3. Arquitectura técnica

- **Frontend:** Angular + Capacitor → Web + Android/iOS
- **Backend:** Flask (API REST)
- **Base de datos:** Supabase (Postgres, Auth, Realtime, Storage)
- **Notificaciones:** FCM (Android/Web), APNs (iOS)
- **Mapas:** Google Maps API (Place ID y Geocoding)
- **Autenticación:** Supabase Auth (correo, link mágico, o login biométrico Face ID/Touch ID)
- **Idiomas:** ES / EN / PT (cambio en tiempo real desde header)

---

## 🔹 4. Registro y login

- Pantalla inicial con descripción breve y botones **Iniciar sesión** / **Registrarse**.

### Registro:
- País (desplegable)
- Nombre, Apellido
- Correo (se valida por link)
- Contraseña

Al registrarse, se crea un email primario (igual al usuario, editable luego).

### Campos adicionales editables desde Perfil:
- Teléfono, Dirección, Ciudad, Idioma, País, Foto (opcional)
- Campo `is_admin` definido manualmente desde BD.

---

## 🔹 5. Home según rol

### Usuario (dueño)
Botones principales:
- Mis Mascotas
- Buscar Servicios
- Mis Chats
- Calendario
- Mascotas Perdidas
- Mis Paseos
- Cruces

### Proveedor
Botones principales:
- Mis Servicios
- QR Scanner
- Mis Chats
- Mascotas Perdidas
- Mis Calificaciones
- Calendario
- Mis Historias
- Mis Vacunas
- Mis Paseos

---

## 🔹 6. Mis Mascotas

- Visualización en tarjetas (foto, nombre, edad, vacunas al día, especie, raza, sexo).
- Máx. 9 por página (paginación).

### Campos al crear:
**Obligatorios:** Nombre, Fecha nacimiento, Especie, Raza, Sexo
**Opcionales:** Foto, Papeles, "Apto cruce", "Con papeles"

- **Especie y raza son inmutables.**
- Se genera automáticamente un **DNIA** (Documento Nacional de Identidad Animal):
  - **Formato:** PAIS2 + ESP3 + RAZ2 + 7 dígitos
  - **Ejemplo:** ARPERJR0000001

### Acciones:
- Editar imagen
- Registrar vacuna
- Ver historial médico
- Ver QR
- Ver papeles
- Eliminar (soft delete)

---

## 🔹 7. Vacunación e historial

- Cada mascota tiene su propio registro de vacunación y médico.
- **Veterinarios pueden agregar datos durante 2 horas** luego de escanear el QR.

### Cada vacuna tiene:
- Nombre
- Obligatoria u opcional
- Descripción
- Frecuencia sugerida (`interval_days`)
- Si es contagiosa o no

### Al aplicar vacuna:
- Se calcula la próxima dosis sugerida (`next_due_on`).
- Se registran `applied_on`, `applied_by`, `pet_id`.

### Historial médico:
- Notas, diagnósticos, observaciones, documentos adjuntos.
- El **QR da acceso temporal** al historial y vacunas.

---

## 🔹 8. Buscar servicios

- Filtro por tipo de servicio (veterinario, paseador, petshop, etc.)

### Cada proveedor muestra:
- Nombre, tipo, descripción
- Dirección (Google Place ID)
- Matrícula (si aplica)
- Calificación promedio
- Calendario de atención

### Acciones:
- **Contactar** (abre chat)
- **Agendar cita**
- **Calificar proveedor** (1 cada 30 días)

⚠️ **El proveedor no ve el mail ni el teléfono del usuario.**

---

## 🔹 9. Cruces (Buscar pareja)

- Listado de mascotas con "Apto cruce" activo.
- **Filtros:** Especie, Raza, Con papeles, Sexo.
- **Muestra:** nombre, edad, foto, DNIA, si tiene papeles.

### Reglas:
- Al contactar → se crea chat privado.
- Solo se puede enviar **una intención de cruce cada 7 días**.
- Usuarios pueden desactivar "Apto cruce" desde "Editar mascota".

---

## 🔹 10. Calendario

Eventos coloreados:
- 🔵 **Azul** → Citas
- 🔴 **Rojo** → Vacunas obligatorias
- 🟡 **Amarillo** → Vacunas opcionales
- ⚫ **Gris** → Medicaciones / tratamientos

Desde cita → se puede **cancelar** (notifica automáticamente al proveedor)

---

## 🔹 11. Mascotas perdidas

- Publicaciones visibles con foto, especie, raza, ubicación, descripción.
- **Filtros por radio** (en km) desde ubicación actual.

### Dos opciones:
1. Reportar mascota propia perdida
2. Reportar mascota encontrada

- Si se marca "encontrada" → desaparece de la lista.
- Permite incluir teléfono opcional y mensaje.
- Los demás usuarios pueden contactar por chat.

---

## 🔹 12. Mis paseos

- Registra cada paseo iniciado por un paseador al escanear el QR de la mascota.
- Al finalizar el paseo, se vuelve a escanear el QR para marcar el fin.
- Si en **10 horas** no se escaneó el fin → **se autocierra automáticamente**.
- Paginación de 20 registros.

---

## 🔹 13. Chats

- Sidebar con lista de chats y mensajes.
- Previsualización del último mensaje.
- **Proveedor no puede iniciar chats** (solo responder).
- Eliminar chat → solo lo oculta para ese usuario.
- Mensajes no muestran mails ni teléfonos.
- Notificaciones activables/desactivables por usuario.

---

## 🔹 14. Configuración

### Perfil:
- Editar datos personales.

### Seguridad:
- Cambiar contraseña.

### Notificaciones:
Habilitar/deshabilitar:
- Generales
- Chat
- Vacunas
- Citas
- Mascotas perdidas cercanas (con rango km)

### Eliminar cuenta:
- Soft delete (se desactivan notificaciones, pero no se borra el registro).

---

## 🔹 15. Panel Admin

### Métricas:
- Nuevos usuarios / mes
- Mascotas registradas
- Conversaciones iniciadas
- Citas agendadas
- Facturación (futuro)
- Filtro por país

Dashboard visible solo para `is_admin=true`.

---

## 🔹 16. Monetización (futuro)

- Suscripción mensual para proveedores (`plan_fee` en BD, activable).
- Publicidad dentro de la app (similar a app Banco Nación).
- Pagos: Mercado Pago (tokenización, sin almacenar PAN).

---

## 🔹 17. Seguridad

- **RLS activado** en todas las tablas (cada usuario solo ve sus datos).
- **Soft delete** (`is_deleted=true`).
- Validación de matrícula veterinaria (manual o API externa futura).

### Anti-spam:
- Máx. 20 mensajes/hora
- 1 intento de cruce cada 7 días
- 5 reportes de perdidos por día

---

## 🔹 18. Internacionalización

- Archivos `/i18n/es.json`, `/i18n/en.json`, `/i18n/pt.json`
- Traducción completa de menú, botones, mensajes, placeholders.
- Selector de idioma en header con persistencia en `profile.language`.

---

## 🔹 19. Tests (para Claude Code)

### API tests (pytest)
- Registro/login → 200 OK
- Crear mascota → OK
- Cambiar especie/raza → error 409
- Aplicar vacuna (dueño) → OK
- Aplicar vacuna (vet sin QR) → 403
- Intento de cruce dentro de 7 días → 429
- Proveedor inicia chat → 403
- Paseo sin cierre 10h → autocierre
- Desactivar notificaciones chat → se aplica
- DNIA formato correcto

### DB tests (psql)
- Triggers `trg_set_dnia` y `prevent_species_breed_change` activos
- Función `autoclose_walks` actualiza correctamente
- `breeding_public` muestra mascotas aptas
- Secuencia DNIA correcta

---

## 🔹 20. Orden de instalación en Supabase

1. `animal_humano_schema.sql`
2. `animal_humano_breeding_patch_v2.sql`
3. `animal_humano_patch_dnia_maps_walks.sql`
4. `sql_patch_immutability.sql`
5. Importar `seed_species.csv`, `seed_breeds.csv`, `seed_vaccines.csv`
