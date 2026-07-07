"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { supabase } from "@/lib/supabase";

type CalendarDay = {
  date: string;
  volume: number;
  workoutCount: number;
};

function buildCalendar(days: CalendarDay[]) {
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const volumeByDate = new Map<string, number>();
  for (const day of days) {
    volumeByDate.set(day.date, day.volume);
  }

  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  const dayOfWeek = sixMonthsAgo.getDay();
  for (let i = 0; i < dayOfWeek; i++) {
    currentWeek.push({ date: "", volume: 0, workoutCount: 0 });
  }

  const cursor = new Date(sixMonthsAgo);
  while (cursor <= today) {
    const key = cursor.toLocaleDateString("en-CA");
    const day = { date: key, volume: volumeByDate.get(key) ?? 0, workoutCount: volumeByDate.has(key) ? 1 : 0 };
    currentWeek.push(day);

    if (currentWeek.length === 7) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: "", volume: 0, workoutCount: 0 });
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function colorForVolume(volume: number, maxVolume: number): string {
  if (volume === 0) return "bg-zinc-900";
  const ratio = Math.min(1, volume / (maxVolume || 1));
  if (ratio < 0.25) return "bg-lime-900/50";
  if (ratio < 0.5) return "bg-lime-700/60";
  if (ratio < 0.75) return "bg-lime-500/70";
  return "bg-[#CCFF00]";
}

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DAY_LABELS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export function TrainingCalendar() {
  const { user } = useSession();
  const [weeks, setWeeks] = useState<CalendarDay[][]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function load() {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: workouts } = await supabase
        .from("workout_logs")
        .select("start_time, set_logs(weight, reps, is_warmup)")
        .not("end_time", "is", null)
        .gte("start_time", sixMonthsAgo.toISOString())
        .order("start_time", { ascending: true });

      const calendarDays: CalendarDay[] = [];
      const volumeByDate = new Map<string, number>();

      if (workouts) {
        for (const workout of workouts) {
          const key = new Date(workout.start_time).toLocaleDateString("en-CA");
          const dayVolume = (workout.set_logs || [])
            .filter((sl: any) => !sl.is_warmup)
            .reduce((sum: number, sl: any) => sum + Number(sl.weight || 0) * Number(sl.reps || 0), 0);
          volumeByDate.set(key, (volumeByDate.get(key) ?? 0) + dayVolume);
        }

        for (const [date, volume] of volumeByDate) {
          calendarDays.push({ date, volume, workoutCount: 1 });
        }
      }

      setWeeks(buildCalendar(calendarDays));
      setIsLoading(false);
    }

    void load();
  }, [user]);

  if (isLoading) return null;
  if (!user || weeks.length === 0) return null;

  const maxVolume = Math.max(...weeks.flat().map((d) => d.volume), 1);

  return (
    <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider mb-4">Calendario de entrenamiento</p>
      <div className="overflow-x-auto">
        <div className="mb-1 flex gap-0.5">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="w-5 text-[8px] text-zinc-600 text-center">{label}</div>
          ))}
        </div>
        {weeks.slice(-26).map((week, wi) => (
          <div key={wi} className="flex gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                title={day.date ? `${day.date}: ${Math.round(day.volume)} kg` : ""}
                className={`h-3.5 w-3.5 rounded-sm ${colorForVolume(day.volume, maxVolume)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1 text-[9px] text-zinc-500">
        <span className="h-3 w-3 rounded-sm bg-zinc-900" />
        <span>Sin registro</span>
        <span className="h-3 w-3 rounded-sm bg-lime-900/50 ml-1" />
        <span className="h-3 w-3 rounded-sm bg-lime-700/60" />
        <span className="h-3 w-3 rounded-sm bg-lime-500/70" />
        <span className="h-3 w-3 rounded-sm bg-[#CCFF00]" />
        <span>Mayor volumen</span>
      </div>
    </section>
  );
}
