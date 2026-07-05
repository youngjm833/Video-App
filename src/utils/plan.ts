import type { EditPlan } from '../types'

export const CROSSFADE_SECONDS = 0.5

export interface PlanTiming {
  /** Output seconds each segment contributes (duration / speed). */
  outDurations: number[]
  /** Overlap seconds for each junction (empty for hard cuts). */
  fades: number[]
  /** Final video length: sum of segments minus crossfade overlaps. */
  total: number
}

export function planTiming(plan: EditPlan): PlanTiming {
  const outDurations = plan.segments.map((s) => s.duration / s.speed)
  const fades =
    plan.transitions === 'crossfade' && outDurations.length > 1
      ? outDurations.slice(1).map((d, i) =>
          // A fade can't exceed half of either adjoining segment.
          Math.round(Math.min(CROSSFADE_SECONDS, outDurations[i] / 2, d / 2) * 1000) / 1000,
        )
      : []
  const total =
    outDurations.reduce((sum, d) => sum + d, 0) - fades.reduce((sum, f) => sum + f, 0)
  return { outDurations, fades, total }
}
