# Integración de Strava en JMiraOlivos/Fitness — propuesta ajustada

**Repositorio:** `JMiraOlivos/Fitness`
**Base:** revisión de `propuesta_integracion_strava_fitness.md` contra el código real del repo.
**Fecha:** 12 de julio de 2026
**Estado:** plan ajustado + Fase 1 implementada.

> Este documento no reemplaza la propuesta original, la **corrige** en los puntos donde
> chocaba o duplicaba lo que ya existe en el código, y deja constancia de qué se
> implementó en la Fase 1.

---

## 1. Veredicto

La propuesta original es sólida y está bien calibrada: Strava como puente (sin
Capacitor ni apps nativas), sincronización manual antes que webhooks, service role
acotado a tokens, scopes mínimos y streams como arrays. Encaja con el stack real
(Next.js 14 App Router, Supabase, RLS, patrón `getAuthenticatedClient`, FK a
`public.profiles`).

Al contrastarla con el código aparecieron **cuatro desajustes** que este plan corrige.

---

## 2. Ajustes respecto a la propuesta original

### 2.1 Las zonas FC y `max_heart_rate` YA EXISTEN — no duplicar (era la Sección 11)

El trabajo reciente de cardio (`supabase/migrations/20260723_add_cardio_planning_and_hr.sql`)
ya añadió:

- `profiles.max_heart_rate` con `check (between 120 and 240)`.
- `profiles.birth_year`.
- `src/lib/training/hrZones.ts`: `HEART_RATE_ZONES` (Z1–Z5), `estimateMaxHeartRate`
  (fórmula Tanaka **208 − 0.7·edad**, idéntica a la propuesta) y `classifyHeartRateZone`,
  con tests.

La Sección 11 original proponía `alter table profiles add column max_heart_rate ...
check (between 100 and 240)`. Eso **falla**: la columna ya existe y con otro límite (120).

**Corrección aplicada:** se elimina la Sección 11. No se crean columnas de perfil ni
fórmula ni tipos nuevos. Se reutiliza `hrZones.ts`. Lo único nuevo es una función pura
`timePerZone()` (`src/lib/strava/zones.ts`) que recorre los pares `time/heartrate`, usa
`classifyHeartRateZone` y acumula segundos por zona, con cap de intervalo para huecos de
datos.

### 2.2 Ramificar la asociación por tipo de actividad (decisión de producto tomada)

`cardio_logs` ya modela FC (`heart_rate_avg`, `heart_rate_max`, `workout_log_id`,
`program_id`) y existe `/progreso/cardio`. Un wearable produce mayoritariamente cardio,
no sesiones de pesas. La propuesta original asociaba **todo** a `workout_logs` (solo
fuerza).

**Decisión:** ramificar por `sport_type`:

| Tipo Strava | Clasificación | Destino |
|---|---|---|
| `WeightTraining`, `Workout`, `Crossfit`, `HighIntensityIntervalTraining` | fuerza | se **asocia** a un `workout_logs` existente (la sesión se registró en la app; Strava aporta la FC) |
| `Run`, `TrailRun`, `Ride`, `Walk`, `Hike`, `Swim`, `Rowing`, … | cardio | se **crea** un `cardio_logs` (la actividad ES el cardio) y se enlaza |
| resto | otro | queda en staging sin asociar |

`strava_activities` gana **dos FKs nullable**: `workout_log_id` y `cardio_log_id`, con
índices únicos **parciales** (`where … is not null`) para no bloquear las filas del otro
tipo.

### 2.3 Runtime Node en las rutas de Strava

Las rutas existentes usan `runtime = "edge"` (p. ej. `workouts/finish`), y Edge no tiene
`node:crypto`. Las rutas de Strava necesitan AES-GCM y HMAC.

**Corrección aplicada:** todas las rutas de Strava declaran `runtime = "nodejs"` (como
ya hace `user/export`). No son latencia-críticas y así se usa `node:crypto` sin fricción.

### 2.4 OAuth state stateless con HMAC — sin tabla

La propuesta definía a la vez `STRAVA_STATE_SECRET` **y** una tabla
`strava_oauth_states` (redundante).

**Corrección aplicada:** el state es un token firmado
`base64url(userId.expiry).HMAC_SHA256(...)` verificado en el callback sin tocar la base.
El "single-use" real lo garantiza el `code` de Strava (single-use) más la expiración
corta del state (10 min). Se elimina una tabla, su RLS y su limpieza.

### 2.5 Menores

- `min_heartrate` se calcula desde el stream (no viene en el resumen).
- `src/app/api/user/export/route.ts` incluye ahora `strava_activities` y
  `strava_hr_streams` (**nunca** `strava_connections`).
- El borrado de cuenta se resuelve con `ON DELETE CASCADE` desde `profiles`.
- `.env.example` documenta las nuevas variables (todas server-side, sin `NEXT_PUBLIC_`).
- `STRAVA_REDIRECT_URI` se deriva de `NEXT_PUBLIC_SITE_URL` si no se define.

---

## 3. Modelo de datos (final)

Migración: `supabase/migrations/20260724_add_strava_integration.sql`.

- **`strava_connections`** (PK `user_id`): tokens cifrados (AES-256-GCM), `token_expires_at`,
  `scopes`, `status`, metadatos de última sync. **RLS habilitado SIN policies** → solo
  accesible por el service role server-side. El navegador nunca ve tokens.
- **`strava_activities`** (staging): datos crudos de cada actividad + `workout_log_id` y
  `cardio_log_id` nullable + `match_status` (`matched_auto`/`matched_manual`/`unmatched`/
  `ignored`) + `match_score`. `unique(user_id, strava_activity_id)` hace idempotente el
  re-sync. RLS de lectura para el dueño; escrituras por el servidor.
- **`strava_hr_streams`**: curva `time_seconds[]` / `heartrate_bpm[]` (una fila por
  actividad) + `sample_count`, `resolution`. RLS de lectura para el dueño.

No se crean columnas de FC en `profiles` ni tabla de OAuth state.

---

## 4. Servicio y rutas (Fase 1 implementada)

```
src/lib/supabaseAdmin.ts          # cliente service role, uso acotado a Strava
src/lib/strava/
├── types.ts       # formas de la API de Strava y tipos internos
├── errors.ts      # StravaError tipado + mensajes de usuario (es-CL)
├── crypto.ts      # AES-256-GCM (node:crypto) para tokens en reposo
├── oauth.ts       # state HMAC stateless + URL de autorización + scopes
├── client.ts      # wrapper fetch: bearer, rate limit, mapeo de errores
├── tokens.ts      # getValidStravaAccessToken (refresh + persistir rotación)
├── matching.ts    # clasificación por tipo + scoring de asociación (puro)
├── zones.ts       # normalización de streams + timePerZone (reusa hrZones)
└── sync.ts        # orquestación de la sincronización incremental

src/app/api/integrations/strava/
├── connect/route.ts      POST  -> URL de autorización (state firmado)
├── callback/route.ts     GET   -> intercambia code, cifra y guarda, redirige a /perfil
├── status/route.ts       GET   -> estado no sensible (nunca tokens)
├── sync/route.ts         POST  -> sincronización manual, devuelve resumen
├── link/route.ts         POST  -> asociación manual a un workout_log
└── disconnect/route.ts   DELETE-> revoca en Strava (best-effort) y borra la conexión
```

Todas con `runtime = "nodejs"`. `connect/status/sync/link/disconnect` validan al usuario
con `getAuthenticatedClient` (bearer Supabase); `callback` recupera el `user_id` del
state firmado (no hay bearer en la redirección del navegador).

### Detalles de comportamiento

- **Tokens:** access ~6 h; el refresh puede rotar en cada renovación → tras renovar se
  persiste **siempre** el refresh más reciente de inmediato. Renovación cuando faltan
  < 60 min. Refresh rechazado → `status = 'error'` y se pide reconexión.
- **Sync incremental:** `after = last_sync_at − 24 h` (o 30 días la primera vez). Upsert
  por `(user_id, strava_activity_id)` **sin** tocar columnas de asociación (no pisa
  matches previos). Streams solo para actividades con HR que aún no lo tienen. Fallos
  transitorios (429/5xx) **no** avanzan `last_sync_at`.
- **Matching:** fuerza → candidatos `workout_logs` finalizados en ±90 min, scoring, y
  autoasocia solo con `score ≥ 70`, candidato único y ≥ 15 puntos sobre el segundo; si no,
  queda `unmatched`. Cardio → crea `cardio_logs` (idempotente vía `cardio_log_id`).

---

## 5. Seguridad (sin cambios respecto al original, confirmado)

- Tokens cifrados con clave dedicada (`STRAVA_TOKEN_ENCRYPTION_KEY`, 32 bytes Base64),
  distinta de `STRAVA_CLIENT_SECRET`. Nunca en `localStorage`, nunca al navegador, nunca
  en logs.
- `strava_connections` con RLS sin policies; service role solo server-side.
- Scope mínimo `activity:read_all`, sin escritura.
- FC tratada como dato sensible: RLS en todas las tablas; a la IA solo agregados
  (`{avg, max, zoneMinutes}`), nunca el stream completo.

---

## 6. Variables de entorno

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=          # opcional; si falta se deriva de NEXT_PUBLIC_SITE_URL
STRAVA_TOKEN_ENCRYPTION_KEY=  # 32 bytes aleatorios en Base64
STRAVA_STATE_SECRET=          # cadena aleatoria larga
SUPABASE_SERVICE_ROLE_KEY=    # solo server-side
```

Generar la clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 7. Testing (Fase 1)

Tests unitarios incluidos (`src/lib/strava/*.test.ts`, 26 casos):

- `crypto`: roundtrip, IV aleatorio, detección de manipulación, clave inválida.
- `oauth`: roundtrip de state, expiración, firma manipulada, secreto distinto.
- `matching`: clasificación por tipo, mapeo a enum de cardio, scoring, decisión
  auto/ambiguo.
- `zones`: emparejado de streams, truncado a la longitud menor, `minHeartRate`,
  `timePerZone` con cap de huecos.

Pendientes (fases siguientes): integración con la API de Strava mockeada y E2E de la UI.

---

## 8. Estado de implementación

- [x] **Fase 1 — backend:** migración, `lib/strava/` completo, `supabaseAdmin`, seis
      rutas API, export de cuenta actualizado, `.env.example`, tests unitarios.
      `tsc`, `next lint`, `vitest` (124 tests) y `next build` en verde.
- [ ] **Fase 1 — UI:** tarjeta de Strava en `/perfil` (conectar/estado/sincronizar/
      desconectar) y LPM prom./máx. en `/historial`.
- [ ] **Fase 2 — stream y gráfico:** curva + zonas en `/historial/[workoutId]`
      (reutilizando `hrZones.ts` + `timePerZone`).
- [ ] **Fase 3 — excepciones:** bandeja de actividades sin asociar, cambiar/ignorar
      asociación.
- [ ] **Fase 4 — webhook (opcional):** solo si el botón manual resulta molesto.

Antes de producción hay que ejecutar la migración en Supabase, registrar la app en
Strava y configurar las variables de entorno en Vercel.
