import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock del cliente Supabase: cada llamada a `.select(...)` decide su respuesta según
// si el select pide las columnas opcionales de supersets (migración 20260723).
const singleResult = vi.fn();
const selectSpy = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: (columns: string) => {
        selectSpy(columns);
        return {
          eq: () => ({
            single: () => Promise.resolve(singleResult(columns)),
          }),
        };
      },
    }),
  },
}));

import { fetchRoutine } from "./workoutQueries";

const missingColumnError = {
  code: "42703",
  message: 'column routine_exercises_1.superset_group does not exist',
};

const routineWithExercises = (withOptional: boolean) => ({
  id: "r1",
  title: "Día de empuje",
  description: null,
  is_deload_week: false,
  routine_exercises: [
    {
      id: "re1",
      order_index: 1,
      target_sets: 3,
      target_reps: "8-10",
      notes: null,
      rest_seconds: 90,
      target_rpe: null,
      target_rir: null,
      tempo: null,
      priority: null,
      progression_rule: null,
      substitution_criteria: null,
      ...(withOptional ? { superset_group: 1, set_style: "dropset" } : {}),
      exercises: { id: "e1", name: "Press banca", target_muscle: "pecho", equipment: "barra" },
    },
  ],
});

describe("fetchRoutine", () => {
  beforeEach(() => {
    singleResult.mockReset();
    selectSpy.mockReset();
  });

  it("devuelve la rutina con columnas de superserie cuando la migración está aplicada", async () => {
    singleResult.mockImplementation(() => ({ data: routineWithExercises(true), error: null }));

    const { data, error } = await fetchRoutine("r1");

    expect(error).toBeNull();
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(data?.routine_exercises?.[0].superset_group).toBe(1);
    expect(data?.routine_exercises?.[0].set_style).toBe("dropset");
  });

  it("reintenta sin las columnas opcionales cuando la migración no está aplicada (42703)", async () => {
    singleResult.mockImplementation((columns: string) => {
      if (columns.includes("superset_group")) {
        return { data: null, error: missingColumnError };
      }
      return { data: routineWithExercises(false), error: null };
    });

    const { data, error } = await fetchRoutine("r1");

    // La vista de rutina se recupera aunque falte la migración.
    expect(error).toBeNull();
    expect(selectSpy).toHaveBeenCalledTimes(2);
    expect(data?.title).toBe("Día de empuje");
    // Las columnas opcionales se rellenan a null para no romper los consumidores.
    expect(data?.routine_exercises?.[0].superset_group).toBeNull();
    expect(data?.routine_exercises?.[0].set_style).toBeNull();
  });

  it("no reintenta ni enmascara errores ajenos a las columnas opcionales", async () => {
    const otherError = { code: "PGRST116", message: "no rows" };
    singleResult.mockImplementation(() => ({ data: null, error: otherError }));

    const { data, error } = await fetchRoutine("r1");

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(data).toBeNull();
    expect(error).toEqual(otherError);
  });
});
