import Anthropic from '@anthropic-ai/sdk'
import type { Clip, EditDirector, EditPlan, EditRequest, Segment } from '../types'
import { framesForClip, sampleFrames } from '../utils/frames'
import { FORMAT_BY_ASPECT, type AspectName } from './formats'

const MODEL = 'claude-opus-4-8'
const FALLBACK_CLIP_DURATION = 10

/**
 * JSON schema for the edit plan, enforced via structured outputs so the
 * response parses without cleanup. Structured outputs don't support
 * numeric min/max constraints, so ranges are clamped in code below.
 */
const EDIT_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['targetDuration', 'pacing', 'ordering', 'aspect', 'transitions', 'segments', 'filters', 'title', 'reasoning'],
  properties: {
    targetDuration: { type: 'number', description: 'Intended output length in seconds' },
    pacing: { type: 'string', enum: ['fast', 'medium', 'slow'] },
    ordering: { type: 'string', enum: ['sequential', 'interleaved', 'shuffled'] },
    aspect: { type: 'string', enum: ['landscape', 'portrait', 'square'] },
    transitions: {
      type: 'string',
      enum: ['cut', 'crossfade'],
      description: 'crossfade = 0.5s dissolves between cuts (calm/dreamy briefs); cut = hard cuts (energetic briefs)',
    },
    segments: {
      type: 'array',
      description: 'The cuts, in final playback order',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['clipId', 'start', 'duration', 'speed', 'note'],
        properties: {
          clipId: { type: 'string', description: 'id of the source clip' },
          start: { type: 'number', description: 'Trim start within the source clip, seconds' },
          duration: { type: 'number', description: 'Trimmed length in source seconds, before speed change' },
          speed: { type: 'number', description: 'Playback speed: 0.5 (slow motion) to 2 (timelapse), 1 = normal' },
          note: { type: 'string', description: 'One short phrase: why this moment made the cut' },
        },
      },
    },
    filters: {
      type: 'object',
      additionalProperties: false,
      required: ['grade', 'monochrome', 'letterbox'],
      properties: {
        grade: { type: 'boolean', description: 'Punchy contrast/saturation color grade' },
        monochrome: { type: 'boolean', description: 'Black & white' },
        letterbox: { type: 'boolean', description: 'Cinematic letterbox bars (landscape only)' },
      },
    },
    title: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Opening title card text, or null for none',
    },
    reasoning: {
      type: 'string',
      description: 'Two to four sentences for the user explaining the editing choices, referencing what you saw in the footage',
    },
  },
} as const

const SYSTEM_PROMPT = `You are an expert video editor. You are given raw footage as a set of clips — for each clip you get its metadata and frames sampled at known timestamps — plus the user's description of the video they want.

Produce an edit plan: an ordered list of trimmed segments that cuts the raw footage into the described video.

Editing judgment:
- Pick the visually strongest moments you can actually see in the frames; use each frame's timestamp to trim around it. Avoid dead, static, or redundant stretches.
- Honor everything the user specifies (length, pacing, format, style, title, structure, transitions); choose tastefully where they are silent.
- Transitions: pick 'crossfade' for calm, dreamy, or smooth briefs; 'cut' for energetic ones.
- Vary segment length with pacing: fast ≈ 1.5-3s per cut, medium ≈ 3-5s, slow ≈ 5-8s. The sum of duration/speed should be close to the target duration.
- Segments must stay within each clip's real duration. Speed must be between 0.5 and 2.
- Every clip you reference must use its exact "id" value.
- Write the reasoning for the user: what you saw, what you kept, and why it serves their request.`

interface RawPlan {
  targetDuration: number
  pacing: EditPlan['pacing']
  ordering: EditPlan['ordering']
  aspect: AspectName
  transitions: EditPlan['transitions']
  segments: Array<Segment & { note: string }>
  filters: EditPlan['filters']
  title: string | null
  reasoning: string
}

function clipDuration(clip: Clip): number {
  return clip.duration ?? FALLBACK_CLIP_DURATION
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Clamp the model's plan to physical reality before it reaches ffmpeg. */
function sanitizePlan(raw: RawPlan, clips: Clip[]): EditPlan {
  const clipById = new Map(clips.map((c) => [c.id, c]))
  const segments: Segment[] = []
  for (const segment of raw.segments) {
    const clip = clipById.get(segment.clipId)
    if (!clip) continue
    const total = clipDuration(clip)
    const speed = clamp(segment.speed || 1, 0.5, 2)
    const start = clamp(segment.start, 0, Math.max(total - 0.5, 0))
    const duration = clamp(segment.duration, 0.5, total - start)
    segments.push({
      clipId: segment.clipId,
      start: Math.round(start * 100) / 100,
      duration: Math.round(duration * 100) / 100,
      speed,
      note: segment.note,
    })
  }
  if (segments.length === 0) {
    throw new Error('Claude returned an edit plan with no usable segments. Try rephrasing your description.')
  }
  const output = FORMAT_BY_ASPECT[raw.aspect] ?? FORMAT_BY_ASPECT.landscape
  return {
    targetDuration: raw.targetDuration,
    pacing: raw.pacing,
    ordering: raw.ordering,
    output,
    transitions: raw.transitions === 'crossfade' ? 'crossfade' : 'cut',
    segments,
    filters: {
      ...raw.filters,
      letterbox: raw.filters.letterbox && output === FORMAT_BY_ASPECT.landscape,
    },
    title: raw.title,
    reasoning: raw.reasoning,
  }
}

function describeClip(clip: Clip, frameCount: number): string {
  const duration = clip.duration != null ? `${clip.duration.toFixed(1)}s` : `unknown (assume ${FALLBACK_CLIP_DURATION}s)`
  const dims = clip.width && clip.height ? `${clip.width}x${clip.height}` : 'unknown resolution'
  const frames = frameCount > 0 ? `${frameCount} sampled frames follow` : 'frames unavailable — plan from metadata only'
  return `Clip id: "${clip.id}" — file "${clip.name}", duration ${duration}, ${dims}. ${frames}.`
}

function friendlyError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new Error('Anthropic API key was rejected. Check the key in Settings.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new Error('Anthropic API rate limit hit. Wait a moment and try again.')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new Error('Could not reach the Anthropic API. Check your network connection.')
  }
  if (error instanceof Anthropic.APIError) {
    return new Error(`Anthropic API error: ${error.message}`)
  }
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * The real AI director: samples frames from the footage, sends them to
 * Claude with the user's brief, and gets back a structured edit plan.
 * The API key stays in the browser (localStorage) — fine for personal
 * use; route through a backend before sharing the app with others.
 */
export function createClaudeDirector(apiKey: string): EditDirector {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
  })

  return {
    name: 'Claude Director',

    async createEditPlan(request: EditRequest): Promise<EditPlan> {
      const { clips, prompt } = request
      if (clips.length === 0) throw new Error('Add at least one clip before generating an edit.')

      const clipFrames = await Promise.all(
        clips.map((clip) => sampleFrames(clip, framesForClip(clip))),
      )

      const content: Anthropic.ContentBlockParam[] = []
      clips.forEach((clip, i) => {
        content.push({ type: 'text', text: describeClip(clip, clipFrames[i].length) })
        for (const frame of clipFrames[i]) {
          content.push(
            { type: 'text', text: `Frame at ${frame.time}s:` },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: frame.base64 },
            },
          )
        }
      })
      content.push({
        type: 'text',
        text: `The user wants this video:\n"""${prompt}"""\n\nCreate the edit plan.`,
      })

      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          system: SYSTEM_PROMPT,
          output_config: { format: { type: 'json_schema', schema: EDIT_PLAN_SCHEMA } },
          messages: [{ role: 'user', content }],
        })

        if (response.stop_reason === 'refusal') {
          throw new Error('Claude declined this request. Try rewording your description.')
        }
        const text = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        )
        if (!text) throw new Error('Claude returned no edit plan. Try again.')
        return sanitizePlan(JSON.parse(text.text) as RawPlan, clips)
      } catch (error) {
        throw friendlyError(error)
      }
    },
  }
}
