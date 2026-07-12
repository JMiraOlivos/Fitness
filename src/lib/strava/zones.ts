// Normalización de streams y tiempo por zona de FC. Reutiliza la lógica de zonas ya
// existente (src/lib/training/hrZones.ts) — no redefine rangos ni fórmulas.

import { classifyHeartRateZone } from "../training/hrZones";
import type { HeartRateSample, StravaStreamSet } from "./types";

// Empareja los streams paralelos time[] y heartrate[] en pares {second, bpm}. Strava
// NO garantiza una muestra por segundo ni longitudes idénticas; recorta a la mínima.
export function toSamples(streams: StravaStreamSet): HeartRateSample[] {
  const time = streams.time?.data ?? [];
  const hr = streams.heartrate?.data ?? [];
  const n = Math.min(time.length, hr.length);
  const out: HeartRateSample[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ second: time[i], bpm: hr[i] });
  }
  return out;
}

export function minHeartRate(samples: HeartRateSample[]): number | null {
  let min: number | null = null;
  for (const s of samples) {
    if (s.bpm > 0 && (min === null || s.bpm < min)) min = s.bpm;
  }
  return min;
}

export type ZoneSeconds = {
  zone1Seconds: number;
  zone2Seconds: number;
  zone3Seconds: number;
  zone4Seconds: number;
  zone5Seconds: number;
};

// El tiempo entre dos muestras consecutivas se asigna a la zona de la PRIMERA muestra.
// maxGapSeconds acota huecos largos de datos (una pausa del wearable no debe inflar el
// tiempo en zona): un intervalo mayor se cuenta como maxGapSeconds.
export function timePerZone(
  samples: HeartRateSample[],
  maxHeartRate: number | null,
  maxGapSeconds = 30
): ZoneSeconds {
  const acc: ZoneSeconds = {
    zone1Seconds: 0,
    zone2Seconds: 0,
    zone3Seconds: 0,
    zone4Seconds: 0,
    zone5Seconds: 0,
  };
  if (!maxHeartRate || samples.length < 2) return acc;

  for (let i = 0; i < samples.length - 1; i++) {
    const cur = samples[i];
    const next = samples[i + 1];
    const rawGap = next.second - cur.second;
    if (rawGap <= 0) continue;
    const gap = Math.min(rawGap, maxGapSeconds);

    const zone = classifyHeartRateZone(cur.bpm, maxHeartRate);
    if (!zone) continue;

    switch (zone.zone) {
      case 1: acc.zone1Seconds += gap; break;
      case 2: acc.zone2Seconds += gap; break;
      case 3: acc.zone3Seconds += gap; break;
      case 4: acc.zone4Seconds += gap; break;
      case 5: acc.zone5Seconds += gap; break;
    }
  }
  return acc;
}
