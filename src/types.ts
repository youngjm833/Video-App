/** A raw footage clip the user has loaded into the editor. */
export interface Clip {
  id: string
  file: File
  name: string
  /** Duration in seconds, or null if the browser couldn't read metadata. */
  duration: number | null
  width: number | null
  height: number | null
  /** Data-URL poster frame captured from the clip, if decodable. */
  thumbnail: string | null
}

export interface EditRequest {
  clips: Clip[]
  /** The user's natural-language description of the video they want. */
  prompt: string
}

export type Pacing = 'fast' | 'medium' | 'slow'
export type Ordering = 'sequential' | 'interleaved' | 'shuffled'

export interface OutputFormat {
  width: number
  height: number
  fps: number
  /** Human label, e.g. "16:9 landscape". */
  aspectLabel: string
}

/** One cut in the timeline: a trimmed piece of a source clip. */
export interface Segment {
  clipId: string
  /** Trim start within the source clip, seconds. */
  start: number
  /** Trimmed length in source-clip seconds (before speed change). */
  duration: number
  /** Playback speed multiplier: 0.5 = slow motion, 2 = sped up. */
  speed: number
  /** Why the director chose this moment (shown in the timeline tooltip). */
  note?: string
}

export interface EditPlan {
  targetDuration: number
  pacing: Pacing
  ordering: Ordering
  output: OutputFormat
  segments: Segment[]
  filters: {
    /** Punchy contrast/saturation grade. */
    grade: boolean
    /** Black & white. */
    monochrome: boolean
    /** Cinematic letterbox bars. */
    letterbox: boolean
  }
  title: string | null
  /** The director's explanation of its choices, shown to the user. */
  reasoning: string
}

/**
 * The AI that turns raw footage + a description into an edit plan.
 * `HeuristicDirector` implements this offline; a Claude-backed director
 * can implement the same interface when an API key is available.
 */
export interface EditDirector {
  name: string
  createEditPlan(request: EditRequest): Promise<EditPlan>
}
