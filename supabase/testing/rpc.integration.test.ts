import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fitness_test";

let client: pg.Client;

beforeAll(async () => {
  client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

async function createUser(email: string) {
  // The on_auth_user_created trigger (20260705_add_rls_and_routine_persistence.sql)
  // already inserts a matching public.profiles row for every new auth.users row.
  const { rows } = await client.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [email]);
  return rows[0].id;
}

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("set local role authenticated");
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function sampleRutina(titulo: string) {
  return {
    titulo,
    descripcion: "Rutina de prueba",
    ejercicios: [
      {
        nombre: "Press de banca",
        musculoObjetivo: "Pecho",
        equipamiento: "Barra",
        seriesObjetivo: 4,
        repeticionesObjetivo: "8-10",
        notas: "Controlar el descenso",
      },
    ],
  };
}

function sampleRutinaConEjercicio(titulo: string, nombre: string, musculoObjetivo: string, equipamiento: string) {
  const rutina = sampleRutina(titulo);
  rutina.ejercicios[0] = { ...rutina.ejercicios[0], nombre, musculoObjetivo, equipamiento };
  return rutina;
}

function sampleRutinaConPrograma(titulo: string, programaId: string, numeroSemana: number, diaSemana: number) {
  return { ...sampleRutina(titulo), programaId, numeroSemana, diaSemana };
}

function sampleRutinaConForzarDescarga(titulo: string, programaId: string, numeroSemana: number, diaSemana: number, forzarDescarga: boolean) {
  return { ...sampleRutina(titulo), programaId, numeroSemana, diaSemana, forzarDescarga };
}

function sampleRutinaConPrescripcion(titulo: string) {
  return {
    titulo,
    descripcion: "Rutina de prueba con prescripción",
    ejercicios: [
      {
        nombre: "Sentadilla",
        musculoObjetivo: "Cuádriceps",
        equipamiento: "Barra",
        seriesObjetivo: 4,
        repeticionesObjetivo: "6-8",
        notas: "Controlar el descenso",
        descansoSegundos: 150,
        rpeObjetivo: 8,
        rirObjetivo: 2,
        tempo: "3-1-1",
        patronMovimiento: "squat",
        prioridad: "principal",
        reglaProgresion: "Si completas 4x8 con RPE<=7, sube 2.5kg",
        criterioSustitucion: "Si hay dolor de rodilla, sustituir por prensa",
      },
    ],
  };
}

async function createProgram(
  userId: string,
  overrides: Partial<{ name: string; durationWeeks: number; daysPerWeek: number; deloadEveryNWeeks: number | null }> = {}
) {
  const { name = "Fuerza", durationWeeks = 6, daysPerWeek = 4, deloadEveryNWeeks = null } = overrides;
  return asUser(userId, async () => {
    const { rows } = await client.query<{ id: string }>(
      `insert into public.programs (user_id, name, duration_weeks, days_per_week, deload_every_n_weeks)
       values ($1, $2, $3, $4, $5) returning id`,
      [userId, name, durationWeeks, daysPerWeek, deloadEveryNWeeks]
    );
    return rows[0].id;
  });
}

async function saveRoutine(userId: string, rutina: unknown) {
  return asUser(userId, async () => {
    const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [JSON.stringify(rutina)]);
    return rows[0].save_ai_routine;
  });
}

describe("save_ai_routine RPC", () => {
  it("saves the routine under the calling user's id", async () => {
    const userId = await createUser("owner@example.com");

    const routineId = await asUser(userId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        JSON.stringify(sampleRutina("Día 1 - Empuje")),
      ]);
      return rows[0].save_ai_routine;
    });

    const { rows } = await client.query("select user_id, title from public.routines where id = $1", [routineId]);
    expect(rows[0].user_id).toBe(userId);
    expect(rows[0].title).toBe("Día 1 - Empuje");
  });

  it("persists the prescription fields (rest/RPE/RIR/tempo/priority/progression/substitution)", async () => {
    const userId = await createUser("prescripcion@example.com");

    const routineId = await asUser(userId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        JSON.stringify(sampleRutinaConPrescripcion("Día 1 - Piernas")),
      ]);
      return rows[0].save_ai_routine;
    });

    const { rows } = await client.query(
      `select rest_seconds, target_rpe, target_rir, tempo, movement_pattern, priority, progression_rule, substitution_criteria
       from public.routine_exercises where routine_id = $1`,
      [routineId]
    );

    expect(rows[0].rest_seconds).toBe(150);
    expect(Number(rows[0].target_rpe)).toBe(8);
    expect(Number(rows[0].target_rir)).toBe(2);
    expect(rows[0].tempo).toBe("3-1-1");
    expect(rows[0].movement_pattern).toBe("squat");
    expect(rows[0].priority).toBe("principal");
    expect(rows[0].progression_rule).toBe("Si completas 4x8 con RPE<=7, sube 2.5kg");
    expect(rows[0].substitution_criteria).toBe("Si hay dolor de rodilla, sustituir por prensa");
  });

  it("rejects saving without an authenticated user", async () => {
    await client.query("begin");
    try {
      await client.query("set local role authenticated");
      await expect(client.query("select save_ai_routine($1::jsonb)", [JSON.stringify(sampleRutina("Sin sesión"))])).rejects.toThrow(
        /iniciar sesión/i
      );
    } finally {
      await client.query("rollback");
    }
  });
});

describe("regenerate_ai_routine_day RPC", () => {
  it("rejects a user regenerating a routine they do not own", async () => {
    const ownerId = await createUser("owner2@example.com");
    const intruderId = await createUser("intruder@example.com");

    const routineId = await asUser(ownerId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        JSON.stringify(sampleRutina("Día 1 - Empuje")),
      ]);
      return rows[0].save_ai_routine;
    });

    await expect(
      asUser(intruderId, () =>
        client.query("select regenerate_ai_routine_day($1, $2::jsonb)", [routineId, JSON.stringify(sampleRutina("Hackeado"))])
      )
    ).rejects.toThrow(/no tienes permiso/i);

    const { rows } = await client.query("select title from public.routines where id = $1", [routineId]);
    expect(rows[0].title).toBe("Día 1 - Empuje");
  });

  it("lets the owner regenerate their own routine in place", async () => {
    const ownerId = await createUser("owner3@example.com");

    const routineId = await asUser(ownerId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        JSON.stringify(sampleRutina("Día 1 - Empuje")),
      ]);
      return rows[0].save_ai_routine;
    });

    await asUser(ownerId, () =>
      client.query("select regenerate_ai_routine_day($1, $2::jsonb)", [routineId, JSON.stringify(sampleRutina("Día 1 - Empuje v2"))])
    );

    const { rows } = await client.query("select title from public.routines where id = $1", [routineId]);
    expect(rows[0].title).toBe("Día 1 - Empuje v2");
  });
});

describe("mesociclos / programs", () => {
  it("saves a routine into a program week and computes is_deload_week", async () => {
    const userId = await createUser("meso-owner@example.com");
    const programId = await createProgram(userId, { durationWeeks: 4, deloadEveryNWeeks: 4 });

    const routineId = await saveRoutine(userId, sampleRutinaConPrograma("Semana 4 día 1", programId, 4, 1));

    const { rows } = await client.query(
      "select program_id, week_number, day_of_week, is_deload_week from public.routines where id = $1",
      [routineId]
    );
    expect(rows[0].program_id).toBe(programId);
    expect(rows[0].week_number).toBe(4);
    expect(rows[0].day_of_week).toBe(1);
    expect(rows[0].is_deload_week).toBe(true);
  });

  it("does not mark a non-deload week as a deload week", async () => {
    const userId = await createUser("meso-owner-nodeload@example.com");
    const programId = await createProgram(userId, { durationWeeks: 4, deloadEveryNWeeks: 4 });

    const routineId = await saveRoutine(userId, sampleRutinaConPrograma("Semana 2 día 1", programId, 2, 1));

    const { rows } = await client.query("select is_deload_week from public.routines where id = $1", [routineId]);
    expect(rows[0].is_deload_week).toBe(false);
  });

  it("rejects saving into a program that belongs to another user", async () => {
    const ownerId = await createUser("meso-owner2@example.com");
    const intruderId = await createUser("meso-intruder@example.com");
    const programId = await createProgram(ownerId, { durationWeeks: 4 });

    await expect(saveRoutine(intruderId, sampleRutinaConPrograma("Intruso", programId, 1, 1))).rejects.toThrow(
      /no encontrado o no pertenece/i
    );
  });

  it("rejects a week_number out of range", async () => {
    const userId = await createUser("meso-owner3@example.com");
    const programId = await createProgram(userId, { durationWeeks: 4 });

    await expect(saveRoutine(userId, sampleRutinaConPrograma("Semana inválida", programId, 5, 1))).rejects.toThrow(
      /número de semana inválido/i
    );
  });

  it("rejects a duplicate day within the same program week", async () => {
    const userId = await createUser("meso-owner4@example.com");
    const programId = await createProgram(userId, { durationWeeks: 4 });

    await saveRoutine(userId, sampleRutinaConPrograma("Semana 1 día 1", programId, 1, 1));

    await expect(saveRoutine(userId, sampleRutinaConPrograma("Semana 1 día 1 duplicado", programId, 1, 1))).rejects.toThrow(
      /duplicate key value/i
    );
  });

  it("forces a deload week off cadence when forzarDescarga is true", async () => {
    const userId = await createUser("meso-force-deload@example.com");
    const programId = await createProgram(userId, { durationWeeks: 6, deloadEveryNWeeks: 6 });

    // Week 2 would not be a deload by cadence (deload every 6), but the client
    // forces it based on fatigue/adherence signals (Fase vNext 8).
    const routineId = await saveRoutine(userId, sampleRutinaConForzarDescarga("Semana 2 forzada", programId, 2, 1, true));

    const { rows } = await client.query("select is_deload_week from public.routines where id = $1", [routineId]);
    expect(rows[0].is_deload_week).toBe(true);
  });

  it("does not force a deload week when forzarDescarga is omitted", async () => {
    const userId = await createUser("meso-no-force@example.com");
    const programId = await createProgram(userId, { durationWeeks: 6, deloadEveryNWeeks: 6 });

    const routineId = await saveRoutine(userId, sampleRutinaConPrograma("Semana 2 normal", programId, 2, 1));

    const { rows } = await client.query("select is_deload_week from public.routines where id = $1", [routineId]);
    expect(rows[0].is_deload_week).toBe(false);
  });
});

describe("readiness_logs RLS", () => {
  it("lets a user insert and read their own readiness log", async () => {
    const userId = await createUser("readiness-owner@example.com");

    const logId = await asUser(userId, async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.readiness_logs (user_id, energy, sleep_quality, soreness, joint_pain, available_minutes, notes)
         values ($1, 4, 3, 2, false, 45, 'Todo bien') returning id`,
        [userId]
      );
      return rows[0].id;
    });

    const { rows } = await asUser(userId, () =>
      client.query("select energy, joint_pain from public.readiness_logs where id = $1", [logId])
    );
    expect(rows[0].energy).toBe(4);
    expect(rows[0].joint_pain).toBe(false);
  });

  it("rejects inserting a readiness log under another user's id", async () => {
    const userId = await createUser("readiness-user@example.com");
    const otherUserId = await createUser("readiness-other@example.com");

    await expect(
      asUser(userId, () =>
        client.query(
          `insert into public.readiness_logs (user_id, energy, sleep_quality, soreness, joint_pain)
           values ($1, 3, 3, 3, false)`,
          [otherUserId]
        )
      )
    ).rejects.toThrow();
  });

  it("does not let a user read another user's readiness log", async () => {
    const ownerId = await createUser("readiness-owner2@example.com");
    const intruderId = await createUser("readiness-intruder@example.com");

    await asUser(ownerId, () =>
      client.query(
        `insert into public.readiness_logs (user_id, energy, sleep_quality, soreness, joint_pain)
         values ($1, 2, 2, 4, true)`,
        [ownerId]
      )
    );

    const { rows } = await asUser(intruderId, () => client.query("select * from public.readiness_logs where user_id = $1", [ownerId]));
    expect(rows).toHaveLength(0);
  });
});

describe("ai_generations RLS", () => {
  it("lets a user insert and read their own generation log", async () => {
    const userId = await createUser("ai-owner@example.com");

    const logId = await asUser(userId, async () => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.ai_generations (user_id, type, model, prompt_version, schema_version, input, output, latency_ms, success)
         values ($1, 'routine_generation', 'gemini-2.5-flash', 'v2', 'v2', '{"enfoque":"Hipertrofia"}', '{"rutinas":[]}', 850, true)
         returning id`,
        [userId]
      );
      return rows[0].id;
    });

    const { rows } = await asUser(userId, () => client.query("select type, success, latency_ms from public.ai_generations where id = $1", [logId]));
    expect(rows[0].type).toBe("routine_generation");
    expect(rows[0].success).toBe(true);
    expect(rows[0].latency_ms).toBe(850);
  });

  it("rejects an unrecognized generation type", async () => {
    const userId = await createUser("ai-bad-type@example.com");

    await expect(
      asUser(userId, () =>
        client.query(
          `insert into public.ai_generations (user_id, type, model, prompt_version, schema_version, success)
           values ($1, 'something_else', 'gemini-2.5-flash', 'v1', 'v1', true)`,
          [userId]
        )
      )
    ).rejects.toThrow();
  });

  it("rejects inserting a generation log under another user's id", async () => {
    const userId = await createUser("ai-user@example.com");
    const otherUserId = await createUser("ai-other@example.com");

    await expect(
      asUser(userId, () =>
        client.query(
          `insert into public.ai_generations (user_id, type, model, prompt_version, schema_version, success)
           values ($1, 'workout_insight', 'gemini-2.5-flash', 'v1', 'v1', true)`,
          [otherUserId]
        )
      )
    ).rejects.toThrow();
  });

  it("does not let a user read another user's generation log", async () => {
    const ownerId = await createUser("ai-owner2@example.com");
    const intruderId = await createUser("ai-intruder@example.com");

    await asUser(ownerId, () =>
      client.query(
        `insert into public.ai_generations (user_id, type, model, prompt_version, schema_version, success)
         values ($1, 'workout_insight', 'gemini-2.5-flash', 'v1', 'v1', true)`,
        [ownerId]
      )
    );

    const { rows } = await asUser(intruderId, () => client.query("select * from public.ai_generations where user_id = $1", [ownerId]));
    expect(rows).toHaveLength(0);
  });
});

describe("exercise catalog curation", () => {
  it("matches a curated alias instead of creating a duplicate global exercise", async () => {
    const userId = await createUser("alias-match@example.com");

    const { rows: canonicalRows } = await client.query<{ id: string }>(
      `insert into public.exercises (name, target_muscle, equipment, aliases, is_verified)
       values ('Press de banca curado', 'Pecho', 'Barra', array['Press banca', 'Barbell bench press'], true)
       returning id`
    );
    const canonicalId = canonicalRows[0].id;

    const routineId = await asUser(userId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        JSON.stringify(sampleRutinaConEjercicio("Día alias", "Press banca", "Pecho", "Barra")),
      ]);
      return rows[0].save_ai_routine;
    });

    const { rows: routineExerciseRows } = await client.query("select exercise_id from public.routine_exercises where routine_id = $1", [
      routineId,
    ]);
    expect(routineExerciseRows[0].exercise_id).toBe(canonicalId);

    const { rows: duplicateRows } = await client.query("select count(*)::int as count from public.exercises where lower(name) = lower($1)", [
      "Press banca",
    ]);
    expect(duplicateRows[0].count).toBe(0);
  });

  it("does not match an alias across a different muscle group", async () => {
    const userId = await createUser("alias-scope@example.com");

    await client.query(
      `insert into public.exercises (name, target_muscle, equipment, aliases, is_verified)
       values ('Remo con barra curado', 'Espalda', 'Barra', array['Remo barra'], true)`
    );

    const routineId = await asUser(userId, async () => {
      const { rows } = await client.query<{ save_ai_routine: string }>("select save_ai_routine($1::jsonb)", [
        // Same alias text ("Remo barra"), different muscle group — must not match.
        JSON.stringify(sampleRutinaConEjercicio("Día alias distinto", "Remo barra", "Bíceps", "Barra")),
      ]);
      return rows[0].save_ai_routine;
    });

    const { rows } = await client.query(
      `select e.target_muscle from public.routine_exercises re
       join public.exercises e on e.id = re.exercise_id
       where re.routine_id = $1`,
      [routineId]
    );
    expect(rows[0].target_muscle).toBe("Bíceps");
  });

  it("lets an admin update the global catalog but rejects a regular user", async () => {
    const adminId = await createUser("catalog-admin@example.com");
    const regularId = await createUser("catalog-regular@example.com");
    await client.query("update public.profiles set is_admin = true where id = $1", [adminId]);

    const { rows: exerciseRows } = await client.query<{ id: string }>(
      `insert into public.exercises (name, target_muscle, equipment) values ('Sentadilla libre', 'Cuádriceps', 'Barra') returning id`
    );
    const exerciseId = exerciseRows[0].id;

    // RLS makes the row invisible to a non-admin's UPDATE rather than raising —
    // the statement "succeeds" but silently affects 0 rows.
    const regularUpdateResult = await asUser(regularId, () =>
      client.query("update public.exercises set is_verified = true where id = $1", [exerciseId])
    );
    expect(regularUpdateResult.rowCount).toBe(0);

    await asUser(adminId, () => client.query("update public.exercises set is_verified = true, canonical_name = 'Sentadilla' where id = $1", [exerciseId]));

    const { rows } = await client.query("select is_verified, canonical_name from public.exercises where id = $1", [exerciseId]);
    expect(rows[0].is_verified).toBe(true);
    expect(rows[0].canonical_name).toBe("Sentadilla");
  });
});

describe("supersets and set styles (vNext++ U13)", () => {
  it("persists superset_group and set_style through save_ai_routine", async () => {
    const userId = await createUser("superset-owner@example.com");

    const rutina = {
      titulo: "Día superserie",
      descripcion: "A1/A2",
      ejercicios: [
        { nombre: "Press banca sup", musculoObjetivo: "Pecho", equipamiento: "Barra", seriesObjetivo: 3, repeticionesObjetivo: "10", grupoSuperserie: 1, estiloSerie: "normal" },
        { nombre: "Remo sup", musculoObjetivo: "Espalda", equipamiento: "Barra", seriesObjetivo: 3, repeticionesObjetivo: "10", grupoSuperserie: 1, estiloSerie: "dropset" },
      ],
    };

    const routineId = await saveRoutine(userId, rutina);

    const { rows } = await client.query(
      `select re.superset_group, re.set_style
       from public.routine_exercises re where re.routine_id = $1 order by re.order_index`,
      [routineId]
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].superset_group).toBe(1);
    expect(rows[1].superset_group).toBe(1);
    expect(rows[1].set_style).toBe("dropset");
  });

  it("rejects an unknown set_style", async () => {
    const userId = await createUser("superset-bad-style@example.com");
    await expect(
      asUser(userId, () =>
        client.query(
          `insert into public.routine_exercises (routine_id, exercise_id, order_index, set_style)
           values (gen_random_uuid(), gen_random_uuid(), 1, 'no_existe')`
        )
      )
    ).rejects.toThrow();
  });
});

describe("daily_nutrition_logs RLS (vNext++ U18)", () => {
  it("lets a user upsert and read their own nutrition log", async () => {
    const userId = await createUser("nutrition-owner@example.com");

    await asUser(userId, () =>
      client.query(
        `insert into public.daily_nutrition_logs (user_id, log_date, water_ml, protein_g)
         values ($1, '2026-07-12', 2000, 140)`,
        [userId]
      )
    );

    const { rows } = await asUser(userId, () =>
      client.query("select water_ml, protein_g from public.daily_nutrition_logs where user_id = $1", [userId])
    );
    expect(rows[0].water_ml).toBe(2000);
    expect(Number(rows[0].protein_g)).toBe(140);
  });

  it("enforces one row per user per day", async () => {
    const userId = await createUser("nutrition-unique@example.com");
    await asUser(userId, () =>
      client.query(`insert into public.daily_nutrition_logs (user_id, log_date, water_ml) values ($1, '2026-07-12', 1000)`, [userId])
    );
    await expect(
      asUser(userId, () =>
        client.query(`insert into public.daily_nutrition_logs (user_id, log_date, water_ml) values ($1, '2026-07-12', 1500)`, [userId])
      )
    ).rejects.toThrow();
  });

  it("does not let a user read another user's nutrition log", async () => {
    const ownerId = await createUser("nutrition-owner2@example.com");
    const intruderId = await createUser("nutrition-intruder@example.com");
    await asUser(ownerId, () =>
      client.query(`insert into public.daily_nutrition_logs (user_id, log_date, calories) values ($1, '2026-07-12', 2500)`, [ownerId])
    );

    const { rows } = await asUser(intruderId, () =>
      client.query("select * from public.daily_nutrition_logs where user_id = $1", [ownerId])
    );
    expect(rows).toHaveLength(0);
  });
});

describe("cardio planning (vNext++ U9)", () => {
  it("links a cardio session to a program and reads it back under RLS", async () => {
    const userId = await createUser("cardio-plan@example.com");
    const programId = await createProgram(userId, { name: "Base + cardio" });

    await asUser(userId, () =>
      client.query(
        `insert into public.cardio_logs (user_id, type, duration_seconds, program_id, perceived_effort, heart_rate_max)
         values ($1, 'running', 1800, $2, 7, 175)`,
        [userId, programId]
      )
    );

    const { rows } = await asUser(userId, () =>
      client.query("select program_id, perceived_effort, heart_rate_max from public.cardio_logs where user_id = $1", [userId])
    );
    expect(rows[0].program_id).toBe(programId);
    expect(rows[0].perceived_effort).toBe(7);
    expect(rows[0].heart_rate_max).toBe(175);
  });
});
