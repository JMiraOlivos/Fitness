# NextGen Fitness App

Aplicación móvil adaptativa construida con Next.js App Router, Tailwind CSS, Supabase y Gemini mediante Vercel AI SDK.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase Auth + Database
- Gemini vía `@ai-sdk/google` y `ai`
- `zod` para respuestas estructuradas
- `lucide-react` para iconografía

## Funcionalidad actual

- Dashboard mobile-first tipo PWA.
- Generación de rutinas con Gemini.
- Formulario para ajustar días disponibles, enfoque y restricciones.
- Login con email y contraseña vía Supabase Auth.
- Guardado de rutinas generadas en Supabase.
- Lectura de rutinas guardadas por usuario.
- RLS/policies para proteger datos por usuario.

## Configuración local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Luego abre `http://localhost:3000`.

## Variables de entorno

```bash
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_de_gemini
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

> Nota: el Vercel AI SDK usa `GOOGLE_GENERATIVE_AI_API_KEY` como nombre estándar para Google/Gemini. Se dejó también `GOOGLE_GENERATION_AI_API_KEY` en `.env.example` como alias documental por compatibilidad con notas previas.

## Base de datos

Si el proyecto Supabase está vacío, ejecuta primero:

```txt
supabase/schema.sql
```

Si ya habías ejecutado el schema inicial, ejecuta después:

```txt
supabase/migrations/20260705_add_rls_and_routine_persistence.sql
```

La migración agrega:

- Row Level Security en las tablas principales.
- Policies para que cada usuario lea y escriba solo sus rutinas, entrenamientos y series.
- Trigger `on_auth_user_created` para crear automáticamente un perfil en `public.profiles` cuando se registra un usuario.

## Supabase Auth

El login (`/auth`) usa `supabase.auth.signUp` y `supabase.auth.signInWithPassword` con email y contraseña — no hay magic link ni OTP en el flujo actual.

Para que funcione en producción:

1. Entra a Supabase.
2. Ve a `Authentication -> URL Configuration`.
3. Agrega tu dominio de Vercel en `Site URL`.
4. Si tienes activada la confirmación de email, agrega el mismo dominio en `Redirect URLs` para que el link de confirmación redirija de vuelta a la app.

Ejemplo:

```txt
https://tu-app.vercel.app
```

## Endpoint de IA

`POST /api/ai/generar-rutina`

Body esperado:

```json
{
  "restricciones": "me molesta el hombro derecho",
  "diasDisponibles": 4,
  "enfoque": "hipertrofia upper/lower"
}
```

La respuesta queda validada por `zod` y contiene rutinas estructuradas listas para persistir en Supabase.

## Deploy en Vercel

1. Importa este repo en Vercel.
2. Configura las variables de entorno.
3. Ejecuta el schema/migración en Supabase.
4. Configura URLs de Auth en Supabase.
5. Deploy o Redeploy.
