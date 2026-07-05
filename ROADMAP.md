# Roadmap - NextGen Fitness App

Este roadmap ordena el desarrollo por fases para pasar desde el MVP actual a una app de entrenamiento útil, persistente y medible.

## Estado actual

La app ya cuenta con:

- Dashboard mobile-first.
- Generación de rutinas con Gemini.
- Login por magic link con Supabase Auth.
- Guardado de rutinas generadas en Supabase.
- Lectura de rutinas guardadas.
- Ruta `/entrenar` para elegir rutina.
- Ruta `/entrenar/[routineId]` para iniciar un entrenamiento, registrar series y finalizar sesión.
- Tablas iniciales `profiles`, `exercises`, `routines`, `routine_exercises`, `workout_logs` y `set_logs`.
- Migración con RLS/policies iniciales.

---

## Fase 1 - MVP entrenable y estable

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

## Fase 2 - Historial y dashboard real

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

## Fase 3 - Progreso y analítica de performance

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

## Fase 4 - IA post-entrenamiento

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

## Fase 5 - UX de gimnasio

**Objetivo:** que registrar una serie sea rápido y cómodo durante el entrenamiento.

### Alcance funcional

- Botón para copiar serie anterior.
- Botones rápidos `+2.5 kg`, `-2.5 kg`, `+1 rep`.
- Timer de descanso.
- Autoscroll al siguiente ejercicio.
- Marcar ejercicio como completado.
- Estado visual de progreso dentro de la rutina.

---

## Fase 6 - Arquitectura y seguridad productiva

**Objetivo:** robustecer la app para uso real.

### Alcance técnico

- Mover writes críticos a API routes o server actions.
- Guardar rutinas mediante operación transaccional.
- Deduplicar ejercicios.
- Generar tipos Supabase (`database.types.ts`).
- Separar ejercicios globales y ejercicios personalizados.
- Agregar tests y CI.
- Revisar RLS con casos borde.

---

## Fase 7 - PWA y distribución

**Objetivo:** que se sienta como app móvil instalable.

### Alcance funcional

- Iconos completos.
- Service worker.
- Modo offline básico.
- Cache de rutinas guardadas.
- Mejor experiencia de instalación.

---

## Prioridad inmediata

1. Terminar Fase 1.
2. Crear `/historial`.
3. Reemplazar métricas hardcodeadas del dashboard.
4. Agregar insight IA real al finalizar entrenamiento.
5. Refactor de persistencia de rutinas a operación transaccional.
