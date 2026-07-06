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

## Fase 0 - Correcciones inmediatas (nueva, prioridad máxima)

**Objetivo:** resolver defectos ya en producción y deuda barata antes de seguir sumando features.

- Quitar las restricciones de ejercicios hardcodeadas del prompt global de `generar-rutina` — deben salir de las preferencias reales del usuario (ver Fase 6/perfil persistente), no de un texto fijo para todos.
- Alinear el README con el flujo de auth real (email+contraseña) y eliminar o marcar como muerto `src/app/auth/callback/page.tsx` (handler de magic link inalcanzable).
- Borrar `src/components/ProgressFloatingButton.tsx` (componente sin referencias, superado por `AppNavigation.tsx`).
- Consolidar en una sola migración idempotente las tres reescrituras del mismo día de `save_ai_routine` / `save_routine_with_exercises` (`20260705_save_ai_routine_rpc.sql` → `20260705_atomic_routine_save.sql` → `20260705_save_routine_transaction.sql`).
- Agregar un guard de rango de reps a la fórmula de 1RM estimado (hoy da valores poco confiables para series de 15-20 reps) en `progreso/page.tsx` y `progreso/[exerciseId]/page.tsx`.

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

> La auditoría encontró que el insight post-entrenamiento solo recibe los agregados de la sesión actual, no la tendencia histórica — estructuralmente no puede "detectar fatiga o estancamiento" ni "sugerir deload" como plantea el alcance original de esta fase. Ese trabajo queda movido a la Fase 8.

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

## Fase 6 - Arquitectura y seguridad productiva

> **Reordenada antes de la Fase 5** por la auditoría: construir más UI de gimnasio sobre 5 archivos con tipos duplicados y sin capa de servidor solo agranda la deuda. `database.types.ts` y la consolidación de migraciones (Fase 0) deben ir primero.

**Objetivo:** robustecer la app para uso real.

### Alcance técnico

- Generar tipos Supabase (`database.types.ts`) como fuente única de verdad — hacerlo primero, antes de los ítems siguientes.
- Extraer a `src/lib` el helper de join duplicado (`one()` / `getJoinedExercise()`, copiado hoy en 5 archivos) y la fórmula de 1RM (duplicada y ya divergente entre `progreso/page.tsx` y `progreso/[exerciseId]/page.tsx`).
- Proveedor de sesión/auth compartido (`useSession()`), reemplazando las 7 llamadas independientes a `supabase.auth.getUser()`.
- Mover writes críticos (guardar rutina, registrar serie, finalizar entrenamiento) a Server Actions/API routes — recién después de tener `database.types.ts`.
- Guardar rutinas mediante operación transaccional (ya resuelto por RPC; falta consolidar migraciones — ver Fase 0).
- Deduplicar ejercicios (ya resuelto parcialmente; falta la taxonomía de grupos musculares — ver Fase 8).
- Separar ejercicios globales y ejercicios personalizados.
- Paginación/"cargar más" en `/historial` (hoy `.limit(30)`) y en el detalle de ejercicio (hoy `.limit(100)`).
- Agregar CI (typecheck + lint + build) como red de seguridad antes de este refactor, y tests después.
- Revisar RLS con casos borde.

---

## Fase 5 - UX de gimnasio

**Objetivo:** que registrar una serie sea rápido y cómodo durante el entrenamiento.

### Alcance funcional

- Prellenado "igual que la vez pasada" (pesos/reps de la última sesión de la misma rutina) — sin dependencias de schema, se puede adelantar en paralelo a la Fase 6 si se busca una victoria visible rápida.
- Botón para copiar serie anterior.
- Botones rápidos `+2.5 kg`, `-2.5 kg`, `+1 rep`.
- Timer de descanso — sin dependencias, también adelantable.
- Autoscroll al siguiente ejercicio.
- Marcar ejercicio como completado.
- Estado visual de progreso dentro de la rutina.

---

## Fase 8 - Profundidad de coaching (nueva)

**Objetivo:** que la app deje de ser un logger manual sin ciencia del entrenamiento y empiece a razonar con datos reales del usuario.

### Alcance funcional — fundamentos de datos (requiere migraciones)

- Taxonomía estandarizada de grupos musculares/equipo (hoy `target_muscle`/`equipment` son texto libre generado por la IA en cada llamada, lo que impide agregar volumen semanal por grupo muscular de forma confiable).
- Flag de serie de calentamiento (`set_type`/`is_warmup`) en `set_logs`, para no contaminar volumen/1RM/RPE promedio.
- Perfil de usuario persistente: objetivos, lesiones, preferencias reales en `profiles` (reemplaza el texto libre retipeado en cada generación, y es donde debe vivir la corrección real del bug de la Fase 0).
- Granularidad de RPE (medios puntos o alternativa RIR) en `set_logs.rpe`.

### Alcance funcional — features visibles (dependen de lo anterior)

- Vista de volumen semanal por grupo muscular (depende de la taxonomía).
- Periodización real / sobrecarga progresiva en la generación de rutinas, alimentada con historial real del usuario (depende del perfil persistente).
- Insight post-entrenamiento usando tendencia histórica de varias sesiones, no solo la actual — para cumplir lo que la Fase 4 prometía (detectar fatiga, sugerir deload).
- Registro de peso corporal / medidas corporales (tabla + pantalla nuevas, hoy no existe ninguna).
- Sustitución de ejercicio en plena sesión por dolor/equipo no disponible (depende de la taxonomía).
- Cues técnicos e instrucciones/medios por ejercicio (esfuerzo mayormente de contenido, no de schema).
- Mesociclos/programas de entrenamiento con semanas de descarga programadas — el ítem más ambicioso, al final, una vez el resto de esta fase esté resuelto.

---

## Fase 7 - PWA y distribución

**Objetivo:** que se sienta como app móvil instalable.

### Alcance funcional

- Iconos completos.
- Service worker.
- Modo offline básico.
- Cache de rutinas guardadas.
- Mejor experiencia de instalación.

> Diferir hasta que las Fases 0, 6 y 8 estén sustancialmente resueltas: pulir la instalabilidad de una app a la que aún le falta timer de descanso y volumen por grupo muscular es de menor apalancamiento.

---

## Cobertura de tests

Ampliar más allá del esqueleto de CI de la Fase 6: tests unitarios para volumen/1RM/racha y tests de integración para el RPC de guardado de rutinas. Hacerlo después de que el refactor de la Fase 6 se asiente — escribir tests contra código que está por rearquitecturarse es esfuerzo perdido.

## Curación de la librería de ejercicios

`exercises` es de lectura/escritura global para cualquier usuario autenticado, sin moderación. Suficiente para el MVP, pero a medida que crezca la inversión en taxonomía (Fase 8) y contenido técnico, revisar un flujo de curación para no diluir la calidad.

---

## Prioridad inmediata

1. **Fase 0** — quitar el prompt hardcodeado, alinear docs de auth, borrar código muerto, consolidar migraciones RPC, guard de 1RM.
2. **Fase 6** — `database.types.ts`, helpers compartidos, proveedor de sesión, server actions, paginación, CI.
3. **Fase 8 (fundamentos de datos)** — taxonomía de grupos musculares, flag de calentamiento, perfil persistente, granularidad de RPE.
4. **Fase 5 + Fase 8 (features visibles)** — timer de descanso y "igual que la vez pasada" se pueden adelantar en paralelo; el resto de Fase 8 sigue a sus fundamentos de datos.
5. **Fase 7** — PWA, al final.
