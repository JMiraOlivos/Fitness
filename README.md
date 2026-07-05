# NextGen Fitness App

Aplicación móvil adaptativa construida con Next.js App Router, Tailwind CSS, Supabase y Gemini mediante Vercel AI SDK.

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Gemini vía `@ai-sdk/google` y `ai`
- `zod` para respuestas estructuradas
- `lucide-react` para iconografía

## Estructura

```txt
fitness-app/
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── README.md
├── .env.example
├── supabase/
│   └── schema.sql
├── public/
│   ├── icon.svg
│   └── manifest.json
└── src/
    ├── lib/
    │   └── supabase.ts
    └── app/
        ├── layout.tsx
        ├── globals.css
        ├── page.tsx
        └── api/
            └── ai/
                └── generar-rutina/
                    └── route.ts
```

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

Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase para crear las tablas principales:

- `profiles`
- `exercises`
- `routines`
- `routine_exercises`
- `workout_logs`
- `set_logs`

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
3. Deploy.
