import type {
  Clip,
  EditDirector,
  EditPlan,
  EditRequest,
  Ordering,
  OutputFormat,
  Pacing,
  Segment,
} from '../types'

const LANDSCAPE: OutputFormat = { width: 1280, height: 720, fps: 30, aspectLabel: '16:9 landscape' }
const PORTRAIT: OutputFormat = { width: 720, height: 1280, fps: 30, aspectLabel: '9:16 vertical' }
const SQUARE: OutputFormat = { width: 720, height: 720, fps: 30, aspectLabel: '1:1 square' }

/** Average trimmed-segment length in seconds for each pacing. */
const SEGMENT_LENGTH: Record<Pacing, number> = { fast: 2, medium: 4, slow: 6.5 }

/** Assumed length when a clip's metadata couldn't be read. */
const FALLBACK_CLIP_DURATION = 10

function parseTargetDuration(prompt: string): number | null {
  const minutes = prompt.match(/(\d+(?:\.\d+)?)\s*(?:minute|min)\b/i)
  if (minutes) return Math.round(parseFloat(minutes[1]) * 60)
  const seconds = prompt.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s\b)/i)
  if (seconds) return Math.round(parseFloat(seconds[1]))
  return null
}

function parsePacing(prompt: string): Pacing {
  if (/(fast|punchy|energetic|quick|snappy|hype|action|upbeat|dynamic)/i.test(prompt)) return 'fast'
  if (/(slow|calm|chill|relax|cinematic|dreamy|peaceful|ambient|gentle)/i.test(prompt)) return 'slow'
  return 'medium'
}

function parseOutput(prompt: string): OutputFormat {
  // "reel"/"short"/"story" only imply 9:16 in their social-platform sense
  // ("Instagram reel", "YouTube short") — not in "highlight reel" or "short film".
  if (
    /(vertical|portrait|9:16|tiktok|(?:instagram|insta|ig|youtube|yt|social(?:\s+media)?)\s+(?:reels?|shorts?|story|stories)|snapchat)/i.test(
      prompt,
    )
  ) {
    return PORTRAIT
  }
  if (/(square|1:1|instagram post)/i.test(prompt)) return SQUARE
  return LANDSCAPE
}

function parseOrdering(prompt: string): Ordering {
  if (/(shuffle|random|mix(?:ed)? up)/i.test(prompt)) return 'shuffled'
  if (/(montage|intercut|interleave|back and forth|alternat)/i.test(prompt)) return 'interleaved'
  return 'sequential'
}

function parseSpeed(prompt: string): number {
  if (/(slow[- ]?mo(?:tion)?)/i.test(prompt)) return 0.5
  if (/(time[- ]?lapse|speed(?:ed)? up|hyperlapse)/i.test(prompt)) return 2
  return 1
}

function parseTitle(prompt: string): string | null {
  // e.g. `titled "Summer 2026"` or `with the title 'Road Trip'`
  const match = prompt.match(/titled?\s*[:]?\s*["'“‘]([^"'”’]{1,60})["'”’]/i)
  return match ? match[1] : null
}

/** Deterministic pseudo-random in [0, 1) so plans are reproducible. */
function jitter(seed: number): number {
  return ((seed * 7919 + 104729) % 1000) / 1000
}

function clipDuration(clip: Clip): number {
  return clip.duration ?? FALLBACK_CLIP_DURATION
}

/**
 * Pick trimmed segments spread evenly across each clip, allocating the
 * segment count per clip in proportion to its length.
 */
function pickSegments(
  clips: Clip[],
  targetDuration: number,
  pacing: Pacing,
  ordering: Ordering,
  speed: number,
): Segment[] {
  const baseLength = SEGMENT_LENGTH[pacing]
  // Output time each segment contributes is duration / speed.
  const outputPerSegment = baseLength / speed
  const totalSegments = Math.max(clips.length, Math.min(60, Math.round(targetDuration / outputPerSegment)))

  const totalFootage = clips.reduce((sum, c) => sum + clipDuration(c), 0)
  const perClip: Segment[][] = clips.map((clip, clipIndex) => {
    const share = clipDuration(clip) / totalFootage
    const count = Math.max(1, Math.round(totalSegments * share))
    const segments: Segment[] = []
    for (let i = 0; i < count; i++) {
      const varied = baseLength * (0.8 + 0.4 * jitter(clipIndex * 31 + i))
      const usable = Math.max(clipDuration(clip) - varied, 0)
      // Center each pick in its even slice of the clip.
      const center = ((i + 0.5) / count) * clipDuration(clip)
      const start = Math.min(Math.max(center - varied / 2, 0), usable)
      segments.push({
        clipId: clip.id,
        start: Math.round(start * 100) / 100,
        duration: Math.round(Math.min(varied, clipDuration(clip)) * 100) / 100,
        speed,
      })
    }
    return segments
  })

  let ordered: Segment[]
  if (ordering === 'interleaved') {
    ordered = []
    const maxLen = Math.max(...perClip.map((s) => s.length))
    for (let i = 0; i < maxLen; i++) {
      for (const segments of perClip) {
        if (segments[i]) ordered.push(segments[i])
      }
    }
  } else {
    ordered = perClip.flat()
    if (ordering === 'shuffled') {
      // Deterministic shuffle so the same request yields the same plan.
      ordered = ordered
        .map((segment, i) => ({ segment, key: jitter(i * 13 + 7) }))
        .sort((a, b) => a.key - b.key)
        .map((entry) => entry.segment)
    }
  }

  // Trim the plan down to the target duration.
  const result: Segment[] = []
  let outputTime = 0
  for (const segment of ordered) {
    if (outputTime >= targetDuration && result.length >= clips.length) break
    result.push(segment)
    outputTime += segment.duration / segment.speed
  }
  return result
}

function planDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.duration / s.speed, 0)
}

function describePlan(
  plan: Omit<EditPlan, 'reasoning'>,
  request: EditRequest,
  totalFootage: number,
): string {
  const clipCount = request.clips.length
  const actual = Math.round(planDuration(plan.segments))
  const pacingText = {
    fast: 'fast cuts to keep the energy high',
    medium: 'a balanced editing rhythm',
    slow: 'longer, unhurried shots',
  }[plan.pacing]
  const orderingText = {
    sequential: 'kept in chronological order clip by clip',
    interleaved: 'intercut between clips for a montage feel',
    shuffled: 'reordered for variety',
  }[plan.ordering]

  const parts = [
    `I reviewed ${clipCount} clip${clipCount === 1 ? '' : 's'} (${Math.round(totalFootage)}s of raw footage) and cut ${plan.segments.length} segments totaling ~${actual}s, aiming for your ${plan.targetDuration}s target.`,
    `I chose ${pacingText}, with segments ${orderingText}, framed for ${plan.output.aspectLabel}.`,
  ]
  const speed = plan.segments[0]?.speed ?? 1
  if (speed < 1) parts.push('Everything plays in slow motion as requested.')
  if (speed > 1) parts.push('Footage is sped up for a timelapse effect.')
  const effects: string[] = []
  if (plan.filters.grade) effects.push('a punchy color grade')
  if (plan.filters.monochrome) effects.push('a black & white treatment')
  if (plan.filters.letterbox) effects.push('cinematic letterbox bars')
  if (effects.length) parts.push(`I applied ${effects.join(', ')}.`)
  if (plan.title) parts.push(`The video opens with the title “${plan.title}”.`)
  return parts.join(' ')
}

/**
 * Offline stand-in for an AI director: derives an edit plan from the
 * prompt with keyword heuristics. A Claude-backed implementation of
 * `EditDirector` can replace this without changing the rest of the app.
 */
export const heuristicDirector: EditDirector = {
  name: 'Heuristic Director (offline)',

  async createEditPlan(request: EditRequest): Promise<EditPlan> {
    const { clips, prompt } = request
    if (clips.length === 0) throw new Error('Add at least one clip before generating an edit.')

    const totalFootage = clips.reduce((sum, c) => sum + clipDuration(c), 0)
    const pacing = parsePacing(prompt)
    const ordering = parseOrdering(prompt)
    const speed = parseSpeed(prompt)
    const output = parseOutput(prompt)
    const targetDuration = Math.min(
      parseTargetDuration(prompt) ?? Math.min(45, Math.round(totalFootage * 0.4) || 30),
      // Can't be longer than the sped-adjusted footage itself.
      Math.max(4, Math.round(totalFootage / speed)),
    )

    const segments = pickSegments(clips, targetDuration, pacing, ordering, speed)
    const filters = {
      grade: /(punchy|vibrant|pop|hype|energetic|action)/i.test(prompt),
      monochrome: /(black.?(?:and|&).?white|monochrome|b&w|noir)/i.test(prompt),
      letterbox: /(cinematic|film look|movie|widescreen)/i.test(prompt) && output === LANDSCAPE,
    }
    const title = parseTitle(prompt)

    const plan = { targetDuration, pacing, ordering, output, segments, filters, title }
    // Simulate a moment of "thinking" so the UI flow matches a real API call.
    await new Promise((resolve) => setTimeout(resolve, 600))
    return { ...plan, reasoning: describePlan(plan, request, totalFootage) }
  },
}
