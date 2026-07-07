# Roadmap - NextGen Fitness App

Este roadmap ordena el desarrollo por fases para pasar desde el MVP actual a una app de entrenamiento útil, persistente y medible.

## Estado actual

La app ya cuenta con:

- Dashboard mobile-first con métricas semanales reales (volumen, series, workouts, racha) calculadas desde Supabase.
- Generación de rutinas con Gemini y guardado transaccional vía RPC (`save_ai_routine`).
- Login con email + contraseña por Supabase Auth (**no** magic link — la doc anterior estaba desalineada con el código; ver Fase 0).
- Ruta `/entrenar` para elegir rutina y `/entrenar/[routineId]` para iniciar un entrenamiento, registrar series con RPE y finalizar sesión con insight de IA.
- `/historial` y `/historial/[workoutId]` con volumen, duración y detalle por sesión.
- `/progreso` y `/progreso/[exerciseId]` con volumen, 1RM estimado y tendencia de 90 días por ejercicio.
- Tablas `profiles`, `exercises`, `routines`, `routine_exercises`, `workout_logs` y `set_logs`, con RLS/policies y deduplicación de ejercicios.

## Auditoría (2026-07-06): hallazgo crítico y reordenamiento de prioridades

Se hizo una auditoría en profundidad desde dos ángulos — arquitectura de software y coaching/entrenamiento personal — que reordena la prioridad de las fases de abajo. El hallazgo más importante:

> **`src/app/api/ai/generar-rutina/route.ts` hardcodea restricciones personales en el system prompt para TODOS los usuarios** ("NO incluyas pullups... NO sentadillas búlgaras... prioriza poleas..."), sin importar lo que el usuario escriba en `restricciones`. Parece una preferencia personal filtrada por accidente al prompt global — un bug de correctness activo en la funcionalidad estrella de la app, no una feature faltante.

Este y otros hallazgos de bajo esfuerzo/alto impacto se agrupan en una **Fase 0** nueva que debe ejecutarse antes de continuar con las fases existentes. El detalle completo de la auditoría (arquitectura + coaching, con archivos, esfuerzo e impacto) vive fuera de este roadmap como documento de análisis; este archivo refleja la secuenciación resultante.

---

## Fase 0 - Correcciones inmediatas ✅ (completa, 2026-07-06)

**Objetivo:** resolver defectos ya en producción y deuda barata antes de seguir sumando features.

- ✅ Quitadas las restricciones de ejercicios hardcodeadas del prompt global de `generar-rutina` — el system prompt ya no impone preferencias fijas; las restricciones reales del usuario siguen viajando solo por `restricciones` (la persistencia real de perfil queda para Fase 6/8).
- ✅ README alineado con el flujo de auth real (email+contraseña). `src/app/auth/callback/page.tsx` se eliminó: no había ningún link ni `emailRedirectTo`/`signInWithOtp` que lo alcanzara, era código muerto del magic link previo al pivote (recuperable desde git history si se reactiva ese flujo).
- ✅ Borrado `src/components/ProgressFloatingButton.tsx` (sin referencias, superado por `AppNavigation.tsx`).
- ✅ Consolidadas `20260705_save_ai_routine_rpc.sql` → `20260705_atomic_routine_save.sql` → `20260705_save_routine_transaction.sql` en `20260706_consolidate_save_routine_rpc.sql`, una sola migración idempotente y retrocompatible con entornos que ya corrieron cualquiera de las tres versiones anteriores (validado localmente contra Postgres).
- ✅ Guard de rango agregado a la fórmula de 1RM estimado (no se muestra estimación para series de más de 12 reps) y extraída a `src/lib/oneRepMax.ts`; de paso se consolidó el helper `one()`/`getJoinedExercise()` duplicado en 5 archivos a `src/lib/supabaseJoins.ts`.

---

## Fase 1 - MVP entrenable y estable ✅ (completa)

**Objetivo:** que el usuario pueda generar una rutina, guardarla, iniciar entrenamiento, registrar series y revisar que los datos queden persistidos.

### Alcance funcional

- Conectar navegación del dashboard a `/entrenar`.
- Mejorar acceso desde cada rutina guardada hacia `/entrenar/[routineId]`.
- Validar que `workout_logs` y `set_logs` persisten correctamente.
- Mostrar mensajes claros cuando falta sesión, rutina o permisos.
- Agregar pantalla básica de historial.

### Alcance técnico

- Revisar build de Vercel después de cada commit.
- Mantener TypeScript estricto sin desactivar type-check.
- Consolidar helpers repetidos para joins de Supabase.
- Evitar operaciones que dejen datos parciales en guardado de rutinas.

### Definition of Done

- El usuario puede completar un entrenamiento de punta a punta.
- Vercel build pasa.
- Supabase muestra `workout_logs` y `set_logs` creados.
- Hay navegación clara entre Dashboard, Entrenar e Historial.

---

## Fase 2 - Historial y dashboard real ✅ (completa)

**Objetivo:** reemplazar métricas hardcodeadas por métricas reales desde Supabase.

### Alcance funcional

- Crear `/historial`.
- Listar entrenamientos finalizados.
- Mostrar rutina usada, fecha, duración, volumen total y cantidad de series.
- Crear detalle de entrenamiento.
- Calcular volumen semanal real.
- Calcular racha real.
- Mostrar último entrenamiento.

### Métricas iniciales

- Volumen semanal: `sum(weight * reps)` de los últimos 7 días.
- Series semanales: total de registros en `set_logs`.
- Entrenamientos completados: `workout_logs` con `end_time`.
- Racha: días consecutivos con al menos un entrenamiento.

---

## Fase 3 - Progreso y analítica de performance ✅ (completa)

**Objetivo:** que el usuario entienda si está progresando.

### Alcance funcional

- Crear `/progreso`.
- Vista por ejercicio.
- Evolución de peso, reps y volumen.
- Mejor serie histórica.
- Estimación simple de 1RM.
- Tendencia semanal.

### Alcance técnico

- Crear queries agregadas o views SQL para performance.
- Evaluar uso de RPCs en Supabase para métricas complejas.
- Preparar datos para gráficos.

---

## Fase 4 - IA post-entrenamiento ✅ (completa, con límites — ver auditoría)

> La auditoría encontró que el insight post-entrenamiento solo recibe los agregados de la sesión actual, no la tendencia histórica — estructuralmente no puede "detectar fatiga o estancamiento" ni "sugerir deload" como plantea el alcance original de esta fase. ✅ Resuelto en Fase 8: ahora recibe hasta 4 sesiones previas por ejercicio.

**Objetivo:** que la IA deje de solo generar rutinas y empiece a actuar como coach.

### Alcance funcional

- Enviar resumen del workout a Gemini al finalizar.
- Generar insight real post-entrenamiento.
- Recomendar próximos pesos/reps.
- Detectar fatiga o estancamiento.
- Sugerir deload si corresponde.

### Ejemplo de insight esperado

> Hoy completaste 18 series con 12.400 kg de volumen. Tu press de banca se mantuvo estable, pero el RPE subió en las últimas dos series. Para la próxima sesión, mantén el peso y busca mejorar reps antes de subir carga.

---

## Fase 6 - Arquitectura y seguridad productiva ✅ (completa, 2026-07-06)

> **Reordenada antes de la Fase 5** por la auditoría: construir más UI de gimnasio sobre 5 archivos con tipos duplicados y sin capa de servidor solo agranda la deuda. `database.types.ts` y la consolidación de migraciones (Fase 0) deben ir primero.

**Objetivo:** robustecer la app para uso real.

### Alcance técnico

- ✅ `database.types.ts` (`src/lib/database.types.ts`) como fuente única de verdad, escrito a mano desde `schema.sql` + migraciones (el entorno de desarrollo no tenía red hacia la Management API de Supabase para generarlo con la CLI) y conectado a `createClient<Database>()`.
- ✅ Extraído a `src/lib` el helper de join duplicado (`one()`, ahora en `src/lib/supabaseJoins.ts`) y la fórmula de 1RM (ahora en `src/lib/oneRepMax.ts`, con guard de rango) — resuelto en Fase 0.
- ✅ Proveedor de sesión/auth compartido (`useSession()` en `src/components/SessionProvider.tsx`, montado en el layout raíz), reemplazando las 7 llamadas independientes a `supabase.auth.getUser()` (incluida la suscripción `onAuthStateChange` que el dashboard ya armaba a mano).
- ✅ Writes críticos movidos a API routes: `POST /api/routines/save`, `/api/workouts/start`, `/api/workouts/log-set`, `/api/workouts/finish`. Cada ruta arma un cliente de Supabase con el access token del usuario (no service role), así que RLS sigue aplicando igual que en el cliente. Esto eliminó el fallback legacy no atómico de guardado de rutina (`guardarRutinaLegacy`), lo que a su vez permitió cerrar el hueco de RLS en `exercises` (ver siguiente ítem). **Nota:** no se pudo probar en vivo contra el proyecto real — la política de red del entorno de desarrollo bloquea toda salida hacia Supabase (Management API y el propio host del proyecto) — probar manualmente el flujo completo (generar → guardar rutina, registrar serie, finalizar entrenamiento) antes de confiar en producción.
- ✅ Guardar rutinas mediante operación transaccional (ya resuelto por RPC; migraciones consolidadas en Fase 0).
- ✅ Deduplicación de ejercicios (ya resuelto parcialmente; falta la taxonomía de grupos musculares — ver Fase 8).
- ✅ Separados ejercicios globales y personalizados: columna `owner_id` nullable en `exercises` (null = global) + RLS actualizada. Sin feature de UI todavía que cree ejercicios personales — cambio preparatorio, no rompe el comportamiento actual (dedup global sigue funcionando, verificado).
- ✅ Paginación/"cargar más" en `/historial` (antes `.limit(30)`) y en el detalle de ejercicio (antes `.limit(100)`), con `.range()`.
- ✅ CI (typecheck + lint + build) vía GitHub Actions (`.github/workflows/ci.yml`), con tests unitarios y de integración agregados el 2026-07-07 (ver "Cobertura de tests" más abajo).
- ✅ RLS revisada con casos borde: encontrado y corregido que `workout_logs` no validaba que `routine_id` perteneciera al mismo usuario; documentado (y luego cerrado) que `exercises` permitía insert directo del cliente.

---

## Fase 5 - UX de gimnasio ✅ (completa, 2026-07-06)

**Objetivo:** que registrar una serie sea rápido y cómodo durante el entrenamiento.

### Alcance funcional

- ✅ Prellenado "igual que la vez pasada" — `/entrenar/[routineId]` muestra por ejercicio la última sesión registrada (peso/reps/RPE, en cualquier rutina) junto con una sugerencia de progresión (subir, mantener o bajar carga según el RPE promedio) y un botón para aplicarla a los inputs de la serie actual.
- ✅ Botón "Copiar serie anterior" — copia peso/reps/RPE de la última serie registrada para ese ejercicio en la sesión actual (distinto de "igual que la vez pasada", que mira la sesión anterior).
- ✅ Botones rápidos `+2.5 kg`, `-2.5 kg`, `+1 rep` junto a los inputs de peso y reps.
- ✅ Timer de descanso — 90s automático al registrar una serie, banner flotante descartable sobre la barra de navegación.
- ✅ Autoscroll al siguiente ejercicio — al marcar un ejercicio como completado, hace scroll suave al siguiente pendiente.
- ✅ Marcar ejercicio como completado — toggle independiente de las series hechas, atenúa visualmente la tarjeta.
- ✅ Estado visual de progreso dentro de la rutina — barra "X/N ejercicios completados" junto a Estado/Inicio.

---

## Fase 8 - Profundidad de coaching (nueva)

**Objetivo:** que la app deje de ser un logger manual sin ciencia del entrenamiento y empiece a razonar con datos reales del usuario.

### Alcance funcional — fundamentos de datos (requiere migraciones) ✅ (completa, 2026-07-06)

- ✅ Taxonomía estandarizada de grupos musculares/equipo: 12 grupos musculares + `General` de respaldo, 5 tipos de equipo + `Otro` de respaldo (`src/lib/exerciseTaxonomy.ts`), con CHECK constraints en `exercises` y datos existentes normalizados/deduplicados vía migración.
- ✅ Flag de serie de calentamiento (`set_logs.is_warmup`), excluida de volumen/1RM/RPE promedio y de las sugerencias "igual que la vez pasada" en `/entrenar/[routineId]`.
- ✅ Perfil de usuario persistente (`profiles.training_goal/injury_notes/equipment_available/experience_level`), con pantalla `/perfil` y wireado a `generar-rutina`: las lesiones persistentes ahora siempre viajan al prompt de Gemini, sin depender de que el usuario las retipee — esta es la corrección real del bug de la Fase 0.
- ✅ Granularidad de RPE: `set_logs.rpe` pasó a `numeric(3,1)`, permite medios puntos (7.5, 8.5...) en vez de solo enteros.

### Alcance funcional — features visibles (dependen de lo anterior) ✅ mayormente completa (2026-07-06)

- ✅ Vista de volumen semanal por grupo muscular, en `/progreso` (reutiliza los `set_logs` de 90 días ya cargados, sin query adicional).
- ✅ Sobrecarga progresiva real en la generación de rutinas: `generar-rutina` ahora recibe el desempeño reciente del usuario por ejercicio (peso/reps/RPE de la última vez, hasta 15 ejercicios) y se le instruye aplicar sobrecarga progresiva en vez de generar números genéricos.
- ✅ Insight post-entrenamiento con tendencia histórica: ahora incluye hasta 4 sesiones previas por ejercicio (volumen, peso máximo, RPE promedio) además de la sesión de hoy, para poder detectar fatiga/estancamiento real y sugerir deload — cumple lo que la Fase 4 prometía.
- ✅ Registro de peso corporal / medidas corporales: tabla `body_measurements` nueva + pantalla `/progreso/peso` (peso, % grasa opcional, notas, tendencia vs. registro anterior y vs. el primero).
- ✅ Sustitución de ejercicio en plena sesión: botón "Sustituir" en `/entrenar/[routineId]` que lista otros ejercicios globales del mismo grupo muscular y actualiza `routine_exercises.exercise_id` (persiste para futuras sesiones de la rutina).
- ✅ Mesociclos/programas de entrenamiento (2026-07-07): tabla `programs` + columnas nullable `program_id`/`week_number`/`day_of_week`/`is_deload_week` en `routines` (migración `20260710_add_mesociclos.sql`), semanas de deload a cadencia fija con volumen/intensidad reducidos vía ajuste de prompt en `generar-rutina`/`regenerar-dia`, UI mínima en `/programas` (listar, crear, detalle con generación semana a semana) y banner en el dashboard con la semana activa del programa. **Nota:** es deload programado por cadencia fija, no adaptativo por fatiga/rendimiento, y sin fases explícitas de bloque (base/acumulación/intensificación/test) — ver Fase vNext 8 más abajo para el resto del alcance.
- **Diferido, fuera de este alcance:**
  - Cues técnicos e instrucciones/medios por ejercicio — es esfuerzo de contenido (videos/imágenes/instrucciones reales por ejercicio), no de ingeniería; no hay fuente de contenido para autogenerar esto de forma confiable. El campo `notas` que Gemini ya genera por ejercicio en cada rutina cubre parcialmente esta necesidad hoy.

---

## Fase 7 - PWA y distribución ✅

**Objetivo:** que se sienta como app móvil instalable.

### Alcance funcional

- ✅ Iconos completos: set completo (favicon, 192/512, apple-touch, maskable) generado a partir de `icon.svg`/`icon-maskable.svg` y wireado en `manifest.json` y `metadata.icons`/`appleWebApp` de `layout.tsx`.
- ✅ Service worker: `public/sw.js` hecho a mano (sin Workbox/next-pwa, dado que los assets de Next.js están hasheados por build y no hay manifest fijo que precachear) — cachea el app shell en `install` y usa `network-first` para navegaciones y `stale-while-revalidate` para `/_next/static/*` en runtime. Registrado desde `ServiceWorkerRegistration`.
- ✅ Modo offline básico: fallback estático `public/offline.html` (sin JS ni build hash propio, a diferencia de una página real de Next.js) servido cuando una navegación falla sin red.
- ✅ Cache de rutinas guardadas: el GET a `/rest/v1/routines` se cachea con la misma estrategia `network-first` (`isRoutinesApiRequest` en `sw.js`), para que el listado de rutinas guardadas del dashboard siga disponible offline.
- ✅ Mejor experiencia de instalación: `InstallPrompt` captura `beforeinstallprompt` en Android/Chrome y muestra un banner propio con botón "Instalar"; en iOS Safari (que nunca dispara ese evento) muestra instrucciones manuales de "Agregar a inicio". El dismiss se recuerda en `localStorage`.

> Nota de verificación: el cacheo del GET de rutinas no se pudo probar contra el proyecto de Supabase real (el sandbox de desarrollo bloquea el egress a `supabase.co`), pero reutiliza el helper `networkFirst` ya validado con el resto de navegaciones y un predicado de URL simple y directamente verificable.

---

## Gestión de rutinas guardadas: borrar y regenerar con IA ✅ (añadido fuera de fase, 2026-07-06)

Pedido directo del usuario, no estaba en el roadmap original.

- ✅ Borrar rutina: botón de papelera + confirmación inline en las tarjetas de "Rutinas guardadas" (dashboard) y de `/entrenar`, vía `POST /api/routines/delete`. En este modelo de datos cada rutina guardada ya es un día individual (Gemini genera una semana como varias tarjetas de "Día N", y cada una se guarda como una fila `routines` independiente sin relación entre sí) — así que "borrar la rutina completa" y "borrar un día específico" son la misma operación; no hizo falta introducir un concepto nuevo de "programa"/agrupación de días.
- ✅ Regenerar un día con IA: botón "Regenerar con IA" en `/entrenar/[routineId]` (deshabilitado mientras hay un entrenamiento en curso), con campo de instrucciones opcional. Llama a `POST /api/ai/regenerar-dia`, que le da a Gemini el mismo contexto que el generador principal (perfil, desempeño reciente) más los ejercicios actuales del día, y persiste el resultado con la nueva RPC `regenerate_ai_routine_day` — mantiene el mismo `routine_id` (no rompe la URL ni las referencias de `workout_logs.routine_id`).
- Migración `20260709_regenerate_routine_day_rpc.sql`: añade `regenerate_routine_day`/`regenerate_ai_routine_day` y extrae a un helper compartido (`_insert_routine_exercises`) el loop de dedup-e-inserción de ejercicios que antes estaba solo en `save_routine_with_exercises`, para no duplicarlo. Verificado contra una instancia local de Postgres simulando RLS como dos usuarios distintos: el dueño puede regenerar/borrar su rutina, un usuario ajeno no puede hacer ninguna de las dos cosas.

> Nota de verificación: igual que en fases anteriores, no se pudo probar el flujo completo (login real + click en borrar/regenerar) contra el proyecto de Supabase real por el bloqueo de egress del sandbox — se verificó por revisión de código, `tsc`/`lint`/`build` limpios, y las RPCs contra Postgres local con RLS simulada.

---

## Cobertura de tests ✅ (base agregada, 2026-07-07)

- ✅ Vitest unitario para las funciones puras extraídas a `src/lib/dashboardMetrics.ts` (volumen, racha, formato de etiqueta 1RM) más `oneRepMax.ts`/`supabaseJoins.ts`.
- ✅ Arnés de integración (`supabase/testing/rpc.integration.test.ts`) que aplica `schema.sql` + todas las migraciones contra un Postgres real (shim mínimo de `auth.uid()`/`auth.users`) para ejercitar `save_ai_routine`/`regenerate_ai_routine_day` y sus checks de ownership, sin depender de la CLI de Supabase ni de un proyecto hosteado.
- ✅ CI corre ambos: job rápido de unit tests dentro del build existente, y un job nuevo con el servicio nativo de Postgres de GitHub Actions.
- ⚠️ El job de integración todavía corre con `continue-on-error: true` (primera corrida real contra CI hosteado, no verificable en este sandbox sin egress) — **quitarlo en cuanto se confirme un run verde**, antes de sumarle más peso a ese job. Ver Fase vNext 11.
- Pendiente: tests E2E (Playwright) del flujo principal — no cubierto todavía.

## Curación de la librería de ejercicios

Los ejercicios globales (`owner_id is null`, ver Fase 6) se crean solo a través del RPC `save_ai_routine`, sin moderación — cualquier usuario que genere una rutina puede agregar entradas nuevas al catálogo compartido. Suficiente para el MVP, pero a medida que crezca la inversión en taxonomía (Fase 8) y contenido técnico, revisar un flujo de curación para no diluir la calidad.

---

## Prioridad inmediata

1. ~~**Fase 0**~~ — ✅ completa: prompt hardcodeado quitado, docs de auth alineadas, código muerto borrado, migraciones RPC consolidadas, guard de 1RM agregado.
2. ~~**Fase 6**~~ — ✅ completa: `database.types.ts`, proveedor de sesión, writes críticos movidos a API routes, ejercicios globales/personales separados, paginación, CI, RLS revisada.
3. ~~**Fase 8 (fundamentos de datos)**~~ — ✅ completa: taxonomía de grupos musculares, flag de calentamiento, perfil persistente wireado a `generar-rutina`, granularidad de RPE.
4. ~~**Fase 8 (features visibles)**~~ — ✅ completa: volumen por grupo muscular, sobrecarga progresiva real en generación de rutinas, insight post-entrenamiento con tendencia histórica, registro de peso corporal, sustitución de ejercicio en sesión, mesociclos/programas con deload por cadencia. Queda diferido solo cues técnicos/contenido (no es trabajo de ingeniería).
5. ~~**Fase 5**~~ — ✅ completa: copiar serie anterior, botones rápidos, timer de descanso, autoscroll, marcar completado, progreso visual de la rutina.
6. ~~**Fase 7**~~ — ✅ completa: iconos, service worker, modo offline, cache de rutinas guardadas, prompt de instalación propio.
7. ~~**Cobertura de tests**~~ — ✅ base agregada: unit tests + integración contra Postgres real en CI (queda quitar el `continue-on-error` del job de integración una vez confirmado en verde).

No quedan fases funcionales del roadmap original pendientes. El único ítem abierto de ese roadmap es el diferido explícito de Fase 8 (cues técnicos/contenido — esfuerzo de contenido, no de ingeniería).

Para el siguiente bloque de trabajo, ver **"Roadmap vNext"** más abajo: una revisión externa (2026-07-06) propuso 19 fases nuevas orientadas a calidad de coaching y arquitectura; la sección siguiente las contrasta contra el estado real del repo y prioriza lo que sigue.

---

# Roadmap vNext (contrastado contra el repo, 2026-07-07)

Un análisis externo (`roadmap_vnext_fitness_app.md`, 2026-07-06) propuso 19 fases para llevar la app de "logger con IA" a "coach inteligente". Varias de sus premisas ya estaban desactualizadas respecto al repo real al momento de escribir esto — el análisis no contaba con el trabajo de Fase 8/5/7 (taxonomía, sobrecarga progresiva, tendencia histórica, UX de gimnasio, PWA) ni con el mesociclos + tests agregados el mismo día (`e756a19`). Esta sección revisa cada fase propuesta contra el código/schema actual y deja solo el alcance que sigue siendo un gap real, priorizado.

**Leyenda:** ✅ ya cubierto (no requiere trabajo nuevo) · 🟡 parcial (base existe, falta alcance) · ⬜ pendiente (no existe).

## Fase vNext 0 — Roadmap y QA

🟡 Parcial. Este mismo `ROADMAP.md` ya cumple el rol de "roadmap actualizado que no contradice el estado real" tras esta revisión. Falta únicamente `docs/QA_CHECKLIST.md` con el checklist manual (crear usuario → generar rutina → entrenar → historial → progreso → programas → RLS cruzada) — no existe todavía como documento separado.

## Fase vNext 1 — Prescripción real (RPE/RIR/tempo/descanso/progresión por ejercicio)

⬜ Pendiente, gap real. Verificado en `supabase/schema.sql`: `routine_exercises` solo tiene series/reps/notas — no existen `rest_seconds`, `target_rpe`, `target_rir`, `tempo`, `movement_pattern`, `priority`, `progression_rule` ni `substitution_criteria`. El prompt de `generar-rutina` ya usa perfil + desempeño reciente (Fase 8) pero no fuerza a Gemini a devolver estos campos estructurados. Mantener la propuesta original: migración con las 8 columnas + CHECK constraints (rpe 1-10, rir 0-5, rest 30-600s, priority enum), actualizar `routineSchema` (Zod) y el prompt, UI resumida en la tarjeta de ejercicio durante el entrenamiento. Manejar `null` para rutinas viejas.

## Fase vNext 2 — Motor determinístico de progresión ✅ (base completa, 2026-07-07)

- ✅ Extraída la heurística de progresión que vivía inline en `/entrenar/[routineId]/page.tsx` a `src/lib/training/progression.ts` (`recommendNextSet`), con 9 tests (`progression.test.ts`): distingue `principal`/`accesorio`/`aislamiento`/`correctivo` (accesorios progresan reps antes que peso, aislamiento es más conservador, correctivo nunca prioriza carga), reduce automáticamente la carga en RPE ≥ 9.5, y **respeta semanas de deload** (`routines.is_deload_week`, de la Fase 8 mesociclos) reduciendo carga ~10% y bloqueando cualquier sugerencia de PR — antes la sugerencia de progresión ignoraba por completo si la semana era de deload.
- ✅ `/entrenar/[routineId]/page.tsx` ahora consume `recommendNextSet` en vez de la heurística inline, y muestra un badge "Semana de deload" en el header cuando aplica.
- Pendiente (fuera de este alcance): `priority` todavía no viene del schema (depende de Fase vNext 1 — hoy el motor asume `"principal"` por defecto para toda rutina existente) y no hay `fatigue.ts` con detección de fatiga multi-sesión todavía (ver Fase vNext 7, que ya tiene la tendencia histórica de 4 sesiones como insumo).

## Fase vNext 3 — Readiness y seguridad

⬜ Pendiente, no existe. No hay tabla `readiness_logs` ni modal previo al entrenamiento. Mantener la propuesta: tabla con energía/sueño/dolor articular/tiempo disponible + RLS, modal de ~20s antes de iniciar sesión, reglas de adaptación (reducir volumen si energía+sueño bajos, sustituir ante dolor articular, recortar accesorios si hay poco tiempo) y guardrail de texto libre ante señales de riesgo (dolor agudo, mareo, etc.).

## Fase vNext 4 — Catálogo curado de ejercicios

🟡 Parcial. Ya cubierto (Fase 6/8 de este roadmap): dedup por nombre/músculo/equipo normalizado, taxonomía fija de 12 grupos musculares + 5 tipos de equipo con CHECK constraints (`src/lib/exerciseTaxonomy.ts`), separación `owner_id` global/personal. **No existe** `canonical_name`, `aliases`, `movement_pattern`, `difficulty`, `is_verified`, ni contenido (`instructions`/`safety_notes`/media). Sustitución de ejercicio (ya implementada en Fase 8) hoy solo filtra por `target_muscle` — no por patrón de movimiento ni dificultad. Alcance restante real: aliases + verificación + pantalla `/admin/exercises` para curar duplicados; es esfuerzo alto y de menor urgencia ahora que el dedup automático ya contiene el problema más agudo (contaminación de catálogo).

## Fase vNext 5 — Home orientado a "qué hago hoy"

🟡 Parcial. `src/app/page.tsx` (558 líneas) ya muestra métricas semanales reales, programa activo y rutinas guardadas, pero mezcla generación IA, borrado y navegación al mismo nivel que "entrenar hoy" — el diagnóstico de dashboard "sobrecargado" sigue siendo válido, aunque menos crítico que lo que describía el análisis original (ya no falta "próximo entrenamiento" ni "programa activo", eso ya está). Alcance restante: reordenar jerarquía visual (CTA "Entrenar ahora" primero, generar rutina nueva pasa a acción secundaria) y modularizar en componentes (`TodayWorkoutCard`, `WeeklyMetrics`, etc.) — esto último se solapa con la Fase vNext 9.

## Fase vNext 6 — Modo entrenamiento ultra-rápido

✅ Mayormente cubierto por la Fase 5 de este roadmap (copiar serie anterior, botones rápidos ±2.5 kg/+1 rep, timer de descanso 90s, autoscroll, marcar completado, progreso visual). Resta solo pulido menor no crítico: botón "copiar toda la sesión anterior" (hoy solo copia por ejercicio), vibración opcional al terminar el descanso, y — comparte causa raíz con Fase vNext 9 — extraer `ExerciseCard`/`SetLogger`/`RestTimer` del monolito de 1082 líneas.

## Fase vNext 7 — Progreso accionable

🟡 Parcial. Volumen semanal por grupo muscular ya existe en `/progreso` (Fase 8). **Falta** comparar ese volumen contra un rango objetivo (ej. "Cuádriceps: 6 / 10-16 series - bajo"), vista de fatiga (RPE subiendo + volumen/carga bajando sesión a sesión) y adherencia (planificado vs. completado, ahora que existen `programs`/`week_number` para calcularlo). Tarjeta de recomendación concreta ("qué ajustar esta semana") depende de este cálculo — es una extensión natural del insight con tendencia histórica ya implementado en Fase 8.

## Fase vNext 8 — Mesociclos más inteligentes

🟡 Parcial. **Ya implementado** (`e756a19`, migración `20260710_add_mesociclos.sql`): tabla `programs`, `routines.program_id`/`week_number`/`day_of_week`/`is_deload_week`, deload a cadencia fija con volumen/intensidad reducidos en el prompt, UI en `/programas`. **Falta** el resto del alcance original: fase explícita por semana (base/acumulación/intensificación/deload/test, hoy solo hay "semana normal" vs. "semana deload"), volumen/intensidad objetivo por fase, deload adaptativo por fatiga/adherencia real (hoy es puramente por cadencia N semanas) y que la generación de la siguiente semana use adherencia/fatiga acumulada, no solo la semana anterior.

## Fase vNext 9 — Arquitectura por features

⬜ Pendiente, gap real y ahora más urgente. Verificado: `src/app/entrenar/[routineId]/page.tsx` tiene **1082 líneas**, `src/app/page.tsx` **558 líneas** — ambos mezclan UI, queries a Supabase, estado y reglas de negocio (incluida la heurística de progresión de Fase vNext 2). Mantener la propuesta de `src/features/{workout,dashboard,...}` con `components/hooks/data/domain`; es prerrequisito práctico de las Fases vNext 2, 5 y 6 (no se puede extraer un motor de progresión testeable ni componentizar el dashboard sin antes separar esta lógica del componente de página).

## Fase vNext 10 — Observabilidad y versionado de IA

⬜ Pendiente, no existe. No hay tabla `ai_generations` ni `src/lib/ai/prompts/*.v1.ts` versionados — los prompts viven inline en las rutas API (`generar-rutina`, `regenerar-dia`, `analizar-entrenamiento`). Mantener la propuesta: tabla de log (modelo, prompt/schema version, input/output, latencia, éxito/error) y extracción de prompts a archivos versionados. Valor alto una vez haya más de una versión de prompt en producción (Fase vNext 1 va a forzar la primera).

## Fase vNext 11 — Testing productivo

🟡 Parcial, con progreso real desde la publicación del análisis original. CI ya corre typecheck + lint + unit tests + build + integración contra Postgres real (`e756a19`). **Falta**: quitar `continue-on-error: true` del job de integración (`ci.yml`) en cuanto se confirme un run verde en GitHub Actions real — el sandbox de desarrollo no tiene egress para verificarlo antes de mergear — y agregar E2E con Playwright del flujo principal (signup → generar → guardar → entrenar → registrar serie → finalizar → historial → progreso). Ningún test cubre todavía reglas de dominio fitness (no existen porque el motor de progresión de Fase vNext 2 tampoco existe aún como módulo separado).

## Fase vNext 12 — Onboarding guiado

⬜ Pendiente. `/perfil` existe (Fase 8: `training_goal`/`injury_notes`/`equipment_available`/`experience_level`) pero como formulario, no como wizard de una pregunta por pantalla con progreso visible. Mantener la propuesta tal cual — es una mejora de UX sobre datos que ya se capturan, no requiere schema nuevo.

## Fase vNext 13 — Contenido técnico por ejercicio

⬜ Pendiente — coincide con lo que este roadmap ya marca como diferido en Fase 8 ("esfuerzo de contenido, no de ingeniería"). Sin cambios: sigue siendo baja prioridad hasta tener una fuente de contenido curado confiable.

## Fase vNext 14 — Offline real con sincronización

🟡 Parcial. Ya cubierto (Fase 7): service worker con app-shell caching, `network-first` para navegaciones, `stale-while-revalidate` para assets, cache del GET de rutinas guardadas, fallback offline estático. **Falta** todo lo que requiere escritura offline: cola local (IndexedDB) para registrar series sin conexión, sync automático al reconectar, resolución de conflictos e indicador de estado "pendiente de sincronizar" — hoy la app cachea lectura pero no soporta registrar series sin red.

## Fase vNext 15 — Personalización avanzada

⬜ Pendiente, no existe. No hay tabla `user_exercise_preferences` ni señal de favoritos/ejercicios evitados. Se solapa con Fase vNext 4 (requiere que exista `is_verified`/matching de catálogo para que "sustituye con frecuencia" tenga sentido agregado). Baja prioridad hasta que la Fase vNext 1-2 den suficiente prescripción/progresión real que aprender a preferir.

## Fase vNext 16 — Cardio, movilidad y salud general

⬜ Pendiente, no existe. Coincide con la evaluación del análisis original: expansión opcional, no crítica para el foco actual de fuerza/hipertrofia. Sin cambios de prioridad.

## Fase vNext 17 — Coach IA proactivo

⬜ Pendiente, no existe tabla `coach_recommendations`. El insight post-entrenamiento con tendencia de 4 sesiones (Fase 8) es la base sobre la que esto se construye — sin Fase vNext 7 (progreso accionable con objetivos) esta fase no tiene de dónde sacar sus recomendaciones ("volumen alto en espalda", "no entrenaste piernas") de forma confiable.

## Fase vNext 18 — Admin/calidad de producto

⬜ Pendiente, no existe. Baja prioridad — depende de que exista contenido que curar (Fase vNext 4) y observabilidad de IA que auditar (Fase vNext 10) antes de que una pantalla `/admin` tenga datos reales que mostrar.

---

## Priorización vNext (P0/P1/P2)

Reordenado desde la matriz del análisis original, con lo ya cubierto (Fases 6/8/vNext 6/8/11 parciales) descontado del esfuerzo restante.

**P0 — siguiente bloque de trabajo**

1. ~~**vNext 2 — Motor de progresión**~~ — ✅ base completa (2026-07-07): `src/lib/training/progression.ts` con tests, ya wireado en `/entrenar/[routineId]`. Se hizo antes que la 9 porque era acotado y de bajo riesgo (funciones puras); la extracción completa del resto del componente sigue pendiente.
2. **vNext 9 — Arquitectura por features.** Sigue pendiente para el resto del componente: `/entrenar/[routineId]/page.tsx` y `/app/page.tsx` todavía mezclan UI/queries/estado.
3. **vNext 1 — Prescripción real.** Gap de coaching de mayor impacto; schema/prompt/UI bien acotados. Además desbloquea que el motor de progresión use `priority` real en vez de asumir `"principal"`.
4. **vNext 3 — Readiness.** Gap de seguridad/personalización diario, esfuerzo medio, tabla + modal + reglas.
5. **vNext 11 (resto) — Quitar `continue-on-error` de integración + E2E.** Ya con la base puesta, es cerrar el loop de calidad, no construirlo desde cero.

**P1 — siguiente**

1. **vNext 7 — Progreso accionable** (volumen vs. objetivo, fatiga, adherencia, recomendación).
2. **vNext 8 (resto) — Mesociclos con fases explícitas y deload adaptativo.**
3. **vNext 10 — Observabilidad IA**, sobre todo una vez Fase vNext 1 introduzca una v2 de schema/prompt que valga la pena versionar y comparar.
4. **vNext 12 — Onboarding guiado.**
5. **vNext 5/6 (resto) — Reordenar Home y pulido final de UX de gimnasio**, en paralelo con la componentización de 9.

**P2 — después**

1. **vNext 4 (resto) — Aliases, verificación y `/admin/exercises`.**
2. **vNext 14 (resto) — Cola offline + sync de series.**
3. **vNext 15 — Personalización avanzada.**
4. **vNext 17 — Coach IA proactivo.**
5. **vNext 13, 16, 18 — Contenido técnico, cardio/movilidad, admin.** Sin cambios respecto al análisis original: baja urgencia.
