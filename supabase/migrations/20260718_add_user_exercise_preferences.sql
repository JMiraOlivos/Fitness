-- vNext 15 — Personalización avanzada: preferencias de ejercicios por usuario.
-- Cada fila captura si el usuario marcó un ejercicio como favorito o evitado,
-- cuántas veces lo ha usado y cuándo fue la última vez.
CREATE TABLE IF NOT EXISTS user_exercise_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  is_favorite boolean DEFAULT false,
  is_avoided boolean DEFAULT false,
  times_used integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

ALTER TABLE user_exercise_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON user_exercise_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
