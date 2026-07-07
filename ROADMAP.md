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
- ✅ Mesociclos/programas de entrenamiento (2026-07-07): tabla `programs` + columnas nullable `program_id`/`week_number`/`day_of_week`/`is_deload_week` en `routines` (migración `20260710_add_mesociclos.sql`), semanas de deload a cadencia fija con volumen/intensidad reducidos vía ajuste de prompt en `generar-rutina`/`regenerar-dia`, UI mínima en `/programas` (listar, crear, detalle con generación semana a semana) y banner en el dashboard con la semana activa del programa. **Nota:** el deload por cadencia fija y la ausencia de fases explícitas ya quedaron resueltos en la Fase vNext 8 (ver más abajo, completa 2026-07-07).
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
- ✅ El job de integración ya no corre con `continue-on-error: true` (2026-07-07): confirmado en verde dos veces en GitHub Actions real antes de quitarlo. Ver Fase vNext 11.
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

## Fase vNext 1 — Prescripción real (RPE/RIR/tempo/descanso/progresión por ejercicio) ✅ (completa, 2026-07-07)

- ✅ Migración `20260711_add_routine_exercise_prescription.sql`: 8 columnas nullable en `routine_exercises` (`rest_seconds`, `target_rpe`, `target_rir`, `tempo`, `movement_pattern`, `priority`, `progression_rule`, `substitution_criteria`) + CHECK constraints (RPE 1-10, RIR 0-5, descanso 30-600s, `priority`/`movement_pattern` como enums). Taxonomía compartida en `src/lib/training/prescriptionTaxonomy.ts` (mismo patrón que `exerciseTaxonomy.ts`), reutilizada por `progression.ts` para el tipo `ExercisePriority`.
- ✅ `generar-rutina` y `regenerar-dia` fuerzan estos 8 campos en el schema Zod (con `z.enum` para prioridad/patrón de movimiento) y el system prompt le pide explícitamente a Gemini que los entregue siempre.
- ✅ `save_ai_routine`/`regenerate_ai_routine_day` mapean las claves en español de Gemini (`descansoSegundos`, `rpeObjetivo`, etc.) a las columnas nuevas vía `_insert_routine_exercises`. **Cuidado real detectado y corregido durante la implementación:** la primera versión de `save_ai_routine` dejaba de reenviar `programaId`/`numeroSemana`/`diaSemana` (mesociclos, Fase 8) al sobreescribir la función — verificado con el test de integración existente antes de mergear, y cubierto ahora con un test nuevo de persistencia de prescripción en `rpc.integration.test.ts`.
- ✅ `/entrenar/[routineId]` muestra el resumen (`RPE 8 · RIR 2 · descanso 2:30 · tempo 3-1-1 · principal`) bajo cada ejercicio y colapsa regla de progresión/criterio de sustitución en un `<details>`. La prioridad real ahora se pasa al motor de progresión de Fase vNext 2 (antes asumía `"principal"` para todo).
- Rutinas guardadas antes de esta migración simplemente no muestran esta línea (todos los campos nuevos son `null`).

## Fase vNext 2 — Motor determinístico de progresión ✅ (base completa, 2026-07-07)

- ✅ Extraída la heurística de progresión que vivía inline en `/entrenar/[routineId]/page.tsx` a `src/lib/training/progression.ts` (`recommendNextSet`), con 9 tests (`progression.test.ts`): distingue `principal`/`accesorio`/`aislamiento`/`correctivo` (accesorios progresan reps antes que peso, aislamiento es más conservador, correctivo nunca prioriza carga), reduce automáticamente la carga en RPE ≥ 9.5, y **respeta semanas de deload** (`routines.is_deload_week`, de la Fase 8 mesociclos) reduciendo carga ~10% y bloqueando cualquier sugerencia de PR — antes la sugerencia de progresión ignoraba por completo si la semana era de deload.
- ✅ `/entrenar/[routineId]/page.tsx` ahora consume `recommendNextSet` en vez de la heurística inline, y muestra un badge "Semana de deload" en el header cuando aplica.
- ✅ `priority` ya viene del schema real (Fase vNext 1, `routine_exercises.priority`) y se pasa a `recommendNextSet`; sigue asumiendo `"principal"` solo para rutinas guardadas antes de esa migración (campo `null`).
- ✅ `fatigue.ts` con detección de fatiga multi-sesión ya existe (Fase vNext 7, 2026-07-07): `detectFatigue` compara RPE/volumen entre las últimas 2 sesiones. Vive en `src/lib/training/fatigue.ts` en vez de junto a `progression.ts` porque se usa desde `/progreso`, no desde el motor de progresión del workout.

## Fase vNext 3 — Readiness y seguridad ✅ (completa, 2026-07-07)

- ✅ Migración `20260712_add_readiness_logs.sql`: tabla `readiness_logs` (energía, calidad de sueño, dolor muscular 1-5, dolor articular, minutos disponibles, nota libre) con RLS (select/insert propios), cubierta con 3 tests de integración (inserta/lee propio, rechaza insertar bajo otro `user_id`, rechaza leer logs ajenos).
- ✅ Reglas de adaptación en `src/lib/training/readiness.ts` (`getReadinessGuidance`), puras y testeadas (8 tests): energía+sueño bajos → aviso de reducir volumen ~20-30%; dolor articular → aviso a usar "Sustituir"; poco tiempo (≤30 min) → marca ejercicios `accesorio`/`aislamiento` como opcionales hoy (usa el campo `priority` real de Fase vNext 1); nota de texto libre con palabras de riesgo (mareo, dolor agudo, etc.) → aviso de consultar a un profesional.
- ✅ Modal "Antes de partir" en `/entrenar/[routineId]` (botones `Adaptar entrenamiento` / `Entrenar igual`, toma <20s), banners de advertencia visibles durante toda la sesión, y tarjetas de ejercicios accesorios/aislamiento atenuadas con badge "Opcional hoy" cuando el tiempo disponible es bajo — la adaptación es puramente visual/client-side, **no regenera la rutina con IA** (cumple el DoD original de "se adapta sin regenerar todo").
- El insert de `readiness_logs` es best-effort: si falla, no bloquea el inicio del entrenamiento (el aviso en pantalla ya se calculó client-side).

## Fase vNext 4 — Catálogo curado de ejercicios

🟡 Parcial. Ya cubierto (Fase 6/8 de este roadmap): dedup por nombre/músculo/equipo normalizado, taxonomía fija de 12 grupos musculares + 5 tipos de equipo con CHECK constraints (`src/lib/exerciseTaxonomy.ts`), separación `owner_id` global/personal. **No existe** `canonical_name`, `aliases`, `movement_pattern`, `difficulty`, `is_verified`, ni contenido (`instructions`/`safety_notes`/media). Sustitución de ejercicio (ya implementada en Fase 8) hoy solo filtra por `target_muscle` — no por patrón de movimiento ni dificultad. Alcance restante real: aliases + verificación + pantalla `/admin/exercises` para curar duplicados; es esfuerzo alto y de menor urgencia ahora que el dedup automático ya contiene el problema más agudo (contaminación de catálogo).

## Fase vNext 5 — Home orientado a "qué hago hoy"

🟡 Parcial. `src/app/page.tsx` (558 líneas) ya muestra métricas semanales reales, programa activo y rutinas guardadas, pero mezcla generación IA, borrado y navegación al mismo nivel que "entrenar hoy" — el diagnóstico de dashboard "sobrecargado" sigue siendo válido, aunque menos crítico que lo que describía el análisis original (ya no falta "próximo entrenamiento" ni "programa activo", eso ya está). Alcance restante: reordenar jerarquía visual (CTA "Entrenar ahora" primero, generar rutina nueva pasa a acción secundaria) y modularizar en componentes (`TodayWorkoutCard`, `WeeklyMetrics`, etc.) — esto último se solapa con la Fase vNext 9.

## Fase vNext 6 — Modo entrenamiento ultra-rápido

✅ Mayormente cubierto por la Fase 5 de este roadmap (copiar serie anterior, botones rápidos ±2.5 kg/+1 rep, timer de descanso 90s, autoscroll, marcar completado, progreso visual). `ExerciseCard`/`SetLogger`/`RestTimerBanner` ya están extraídos como componentes propios (Fase vNext 9). Resta solo pulido menor no crítico: botón "copiar toda la sesión anterior" (hoy solo copia por ejercicio) y vibración opcional al terminar el descanso.

## Fase vNext 7 — Progreso accionable ✅ (completa, 2026-07-07)

- ✅ `src/lib/training/volumeTargets.ts` (+5 tests): rangos semanales de series por grupo muscular (landmarks aproximados de literatura de hipertrofia, no personalizados todavía) y `classifyVolume` (`bajo`/`correcto`/`alto`). `/progreso` ahora muestra "Cuádriceps: 6 / 8-16 series · bajo" con la barra coloreada según el estado, en vez de solo el volumen crudo.
- ✅ `src/lib/training/fatigue.ts` (+6 tests): `detectFatigue` compara las últimas 2 sesiones de un ejercicio (RPE sube + volumen baja ⇒ señal de fatiga). `/progreso` agrupa `set_logs` por ejercicio y sesión (`workout_log_id`) y muestra un badge "Señales de fatiga" en la tarjeta del ejercicio afectado.
- ✅ Adherencia básica: compara `programs.days_per_week` del programa activo contra entrenamientos completados (`end_time` no nulo) en los últimos 7 días, con barra de progreso en `/progreso`.
- ✅ `src/lib/training/weeklyRecommendation.ts` (+6 tests): compone la tarjeta "Qué ajustar esta semana" a partir de los tres signals anteriores (volumen bajo/alto por grupo, ejercicios con fatiga, adherencia por debajo del plan) — solo aparece si hay algo concreto que ajustar.
- Nota de alcance: los rangos de volumen son fijos por grupo muscular, no personalizados por usuario/objetivo/experiencia — eso queda para cuando exista personalización real (Fase vNext 15).

## Fase vNext 8 — Mesociclos más inteligentes ✅ (completa, 2026-07-07)

- ✅ Base ya implementada (`e756a19`, migración `20260710_add_mesociclos.sql`): tabla `programs`, `routines.program_id`/`week_number`/`day_of_week`/`is_deload_week`, deload a cadencia fija, UI en `/programas`.
- ✅ Fase explícita por semana: `src/lib/training/mesocycle.ts` (`classifyMesocyclePhase`, +9 tests) deriva `base`/`acumulación`/`intensificación`/`deload`/`test` a partir de `week_number`/`duration_weeks`/`deload_every_n_weeks` — sin persistir un segundo estado, mismo principio que `is_deload_week` original ("no tener un segundo estado que pueda desincronizarse"). Cada fase tiene multiplicadores de volumen/intensidad objetivo (`MESOCYCLE_PHASE_TARGETS`) que ahora alimentan el prompt de `generar-rutina` (antes solo distinguía deload/no-deload).
- ✅ Deload adaptativo real: `shouldSuggestAdaptiveDeload` combina las señales de fatiga y adherencia de la Fase vNext 7 (≥2 ejercicios con fatiga, o adherencia semanal <50% del plan) y sugiere — nunca fuerza sola — tratar la próxima semana como deload aunque no toque por cadencia. `/programas/[programId]` muestra la sugerencia con motivo y un checkbox explícito para aplicarla.
- ✅ Migración `20260713_add_mesocycle_phase_override.sql`: nuevo parámetro opcional `p_force_deload` en `save_routine_with_exercises`/`save_ai_routine` (`forzarDescarga` desde el cliente) — `is_deload_week` sigue reflejando lo que realmente se pidió para esa semana, ahora con override explícito además de la cadencia. Cubierto con 2 tests de integración nuevos (fuerza deload fuera de cadencia; no lo fuerza si no se pide).
- Nota de alcance: la generación de la semana siguiente sigue usando el historial reciente general (Fase 8 original) más la fase actual — no hay todavía un ajuste que use *específicamente* la adherencia/fatiga de la semana anterior del mismo programa para decidir contenido (más allá de la sugerencia de deload); eso encajaría junto con observabilidad de IA (Fase vNext 10) si se vuelve necesario medirlo con más precisión.

## Fase vNext 9 — Arquitectura por features ✅ (completa, 2026-07-07)

- ✅ `src/features/workout/`: `page.tsx` de `/entrenar/[routineId]` pasó de **1345 a 231 líneas** (había crecido por las Fases vNext 1-3). Extraído a `types.ts`, `domain/workoutMetrics.ts` (funciones puras + 7 tests nuevos), `data/workoutQueries.ts` + `data/workoutMutations.ts` (todo el acceso a Supabase/API routes), `hooks/useWorkoutSession.ts` (el hook que concentra estado + orquestación, 1:1 con la lógica original) y `components/` (`ExerciseCard`, `SetLogger`, `SubstitutionPanel`, `ReadinessModal`, `RegeneratePanel`, `RestTimerBanner`).
- ✅ `src/features/dashboard/`: `src/app/page.tsx` pasó de **558 a 64 líneas**. Mismo patrón: `types.ts`, `data/dashboardQueries.ts` + `data/dashboardMutations.ts`, `hooks/useDashboard.ts`, `components/` (`AccountCard`, `ActiveProgramCard`, `WeeklyMetrics`, `QuickActions`, `CoachGenerator`, `SavedRoutines`).
- Verificación: `tsc`/lint/build limpios, 50 tests unitarios y 13 de integración sin regresiones, y renderizado manual en navegador (Playwright contra el dev server) de ambas páginas sin errores de consola — el repo no tiene React Testing Library, así que no se agregaron tests de componente, solo de la lógica de dominio ya extraída (mismo patrón que `dashboardMetrics.test.ts`).
- No se pudo ejercitar el flujo autenticado completo (login real, registrar serie, etc.) por el mismo bloqueo de egress a Supabase que afecta al resto del repo — verificado el estado no-autenticado de ambas páginas y el comportamiento vía revisión de código 1:1 contra el componente original.

## Fase vNext 10 — Observabilidad y versionado de IA ✅ (completa, 2026-07-07)

- ✅ Migración `20260714_add_ai_generations.sql`: tabla `ai_generations` (tipo, modelo, prompt/schema version, input/output jsonb, latencia, éxito/error) con RLS (select/insert propios), `type` restringido por CHECK a los 3 valores que existen hoy (`routine_generation`, `routine_regeneration`, `workout_insight`) — ampliar el CHECK cuando se implementen los demás tipos del roadmap original (`program_week_generation`, `exercise_substitution`, `coach_recommendation`). Cubierta con 4 tests de integración de RLS.
- ✅ `src/lib/ai/promptVersions.ts`: versión de prompt/schema centralizada por tipo de generación (no se extrajeron los prompts a archivos separados por versión como proponía el análisis original — el valor real pedido era trazabilidad/comparación, no modularizar el texto del prompt; los 3 prompts ya eran razonablemente cortos y extraerlos habría sido riesgo sin beneficio claro).
- ✅ `src/lib/ai/logGeneration.ts`: `logAiGeneration()` best-effort (nunca rompe la ruta si falla el insert), integrado en las 3 rutas de IA (`generar-rutina`, `regenerar-dia`, `analizar-entrenamiento`), midiendo latencia real y registrando tanto éxito como error. Solo registra para llamadas autenticadas — las anónimas no tienen `user_id` para asociar el log, mismo criterio que `getOptionalUserProfile`/`getRecentPerformanceSummary`.
- Nota de alcance: no hay pantalla `/admin/ai` todavía para consultar estos logs (ver Fase vNext 18) — por ahora son consultables directo en la base.

## Fase vNext 11 — Testing productivo 🟡 (gate de integración cerrado, 2026-07-07)

- ✅ CI corre typecheck + lint + unit tests + build + integración contra Postgres real (`e756a19`).
- ✅ Quitado `continue-on-error: true` del job de integración en `ci.yml`: confirmado en verde en GitHub Actions real dos veces consecutivas (PR #4, runs `28840785343` y `28841351223`) antes de sacarlo — el job ahora bloquea el merge si falla.
- ✅ Ya hay cobertura de reglas de dominio fitness: `progression.test.ts` (9), `readiness.test.ts` (8), `workoutMetrics.test.ts` (7) — resuelto junto con las Fases vNext 1-2-9, que es donde ese motor terminó viviendo.
- **Falta**: tests E2E con Playwright del flujo principal (signup → generar → guardar → entrenar → registrar serie → finalizar → historial → progreso). Sin este entorno de sandbox pudiendo levantar un proyecto Supabase real, un E2E tendría que correr contra el mismo Postgres local + shim de auth que ya usa `rpc.integration.test.ts`, o esperar a tener un proyecto de staging — queda para cuando eso exista.

## Fase vNext 12 — Onboarding guiado ✅ (completa, 2026-07-07)

- ✅ `/onboarding`: wizard de una pregunta por pantalla (objetivo → nivel → equipo → restricciones → días disponibles → generar) con barra de progreso, reutilizando las mismas opciones canónicas de `/perfil` (`src/lib/profileOptions.ts`) para no violar los CHECK constraints existentes. Las restricciones se arman con chips de zonas comunes (hombro/rodilla/espalda baja/cadera) + texto libre opcional.
- ✅ El último paso guarda el perfil y genera la primera rutina en el mismo flujo, reutilizando `generateRoutine`/`saveRoutine` de `src/features/dashboard/data/dashboardMutations.ts` (Fase 9) en vez de duplicar esa lógica — cumple el DoD original ("al final: generar primer programa") sin reinventar la generación ya existente en el dashboard.
- ✅ `useDashboard` expone `hasProfile` (derivado de si `training_goal` está seteado) y el dashboard muestra un banner "Completa tu perfil" enlazando a `/onboarding` cuando falta, sin bloquear el resto de la app — un usuario que ya conoce el flujo puede seguir usando `/perfil` directamente.
- Nota de alcance: no se agregó el paso de "preferencias" (pesas libres/máquinas/poleas) del análisis original porque no existe un campo de perfil para guardarlo — forzarlo dentro de `injury_notes` habría sido incorrecto; se retoma si la Fase vNext 15 (personalización) agrega ese campo.

## Fase vNext 13 — Contenido técnico por ejercicio

⬜ Pendiente — coincide con lo que este roadmap ya marca como diferido en Fase 8 ("esfuerzo de contenido, no de ingeniería"). Sin cambios: sigue siendo baja prioridad hasta tener una fuente de contenido curado confiable.

## Fase vNext 14 — Offline real con sincronización

🟡 Parcial. Ya cubierto (Fase 7): service worker con app-shell caching, `network-first` para navegaciones, `stale-while-revalidate` para assets, cache del GET de rutinas guardadas, fallback offline estático. **Falta** todo lo que requiere escritura offline: cola local (IndexedDB) para registrar series sin conexión, sync automático al reconectar, resolución de conflictos e indicador de estado "pendiente de sincronizar" — hoy la app cachea lectura pero no soporta registrar series sin red.

## Fase vNext 15 — Personalización avanzada

⬜ Pendiente, no existe. No hay tabla `user_exercise_preferences` ni señal de favoritos/ejercicios evitados. Se solapa con Fase vNext 4 (requiere que exista `is_verified`/matching de catálogo para que "sustituye con frecuencia" tenga sentido agregado). Baja prioridad hasta que la Fase vNext 1-2 den suficiente prescripción/progresión real que aprender a preferir.

## Fase vNext 16 — Cardio, movilidad y salud general

⬜ Pendiente, no existe. Coincide con la evaluación del análisis original: expansión opcional, no crítica para el foco actual de fuerza/hipertrofia. Sin cambios de prioridad.

## Fase vNext 17 — Coach IA proactivo

⬜ Pendiente, no existe tabla `coach_recommendations`. El insight post-entrenamiento con tendencia de 4 sesiones (Fase 8) y `buildWeeklyRecommendations` (Fase vNext 7, ya completa) son la base sobre la que esto se construye — falta persistir esas recomendaciones como entidad propia (con `is_read`, severidad, etc.) y mostrarlas proactivamente en el Home en vez de solo en `/progreso`.

## Fase vNext 18 — Admin/calidad de producto

⬜ Pendiente, no existe. Baja prioridad — depende de que exista contenido que curar (Fase vNext 4) y observabilidad de IA que auditar (Fase vNext 10) antes de que una pantalla `/admin` tenga datos reales que mostrar.

---

## Priorización vNext (P0/P1/P2)

Reordenado desde la matriz del análisis original, con lo ya cubierto (Fases 6/8/vNext 6/8/11 parciales) descontado del esfuerzo restante.

**P0 — siguiente bloque de trabajo**

1. ~~**vNext 2 — Motor de progresión**~~ — ✅ base completa (2026-07-07): `src/lib/training/progression.ts` con tests, ya wireado en `/entrenar/[routineId]`.
2. ~~**vNext 1 — Prescripción real**~~ — ✅ completa (2026-07-07): migración + prompts + RPCs + UI. Cierra el loop con la 2 (`priority` real en vez de asumida).
3. ~~**vNext 3 — Readiness**~~ — ✅ completa (2026-07-07): tabla + RLS + reglas de adaptación testeadas + modal.
4. ~~**vNext 9 — Arquitectura por features**~~ — ✅ completa (2026-07-07): `src/features/{workout,dashboard}/` con `types/domain/data/hooks/components`. `/entrenar/[routineId]/page.tsx` 1345→231 líneas, `/app/page.tsx` 558→64 líneas.
5. ~~**vNext 11 — Quitar `continue-on-error` de integración**~~ — ✅ completo (2026-07-07): confirmado en verde dos veces en GitHub Actions real (PR #4) antes de quitarlo. Queda pendiente solo el E2E con Playwright, sin bloquear nada del bloque P0.

Con esto queda cerrado el bloque P0 completo del roadmap vNext — mergeado a `main` vía PR #4 (2026-07-07).

**P1 — siguiente**

1. ~~**vNext 7 — Progreso accionable**~~ — ✅ completa (2026-07-07): volumen vs. objetivo, fatiga multi-sesión, adherencia y tarjeta de recomendación en `/progreso`.
2. ~~**vNext 8 (resto) — Mesociclos con fases explícitas y deload adaptativo**~~ — ✅ completa (2026-07-07): fases derivadas + multiplicadores en el prompt + sugerencia de deload adaptativo basada en las señales de la Fase 7.
3. ~~**vNext 10 — Observabilidad IA**~~ — ✅ completa (2026-07-07): tabla `ai_generations` + versionado de prompt/schema + logging en las 3 rutas de IA.
4. ~~**vNext 12 — Onboarding guiado**~~ — ✅ completa (2026-07-07): wizard en `/onboarding`, reutiliza generación/guardado del dashboard, banner de entrada cuando falta perfil.
5. **vNext 5/6 (resto) — Reordenar Home y pulido final de UX de gimnasio**, en paralelo con la componentización de 9.

Con esto quedan 4 de 5 fases del bloque P1 completas. Solo resta el pulido de Home/UX.

**P2 — después**

1. **vNext 4 (resto) — Aliases, verificación y `/admin/exercises`.**
2. **vNext 14 (resto) — Cola offline + sync de series.**
3. **vNext 15 — Personalización avanzada.**
4. **vNext 17 — Coach IA proactivo.**
5. **vNext 13, 16, 18 — Contenido técnico, cardio/movilidad, admin.** Sin cambios respecto al análisis original: baja urgencia.
