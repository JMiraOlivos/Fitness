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

function sampleRutinaConPrograma(titulo: string, programaId: string, numeroSemana: number, diaSemana: number) {
  return { ...sampleRutina(titulo), programaId, numeroSemana, diaSemana };
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
});
