import type { Clip, EditPlan } from '../types'
import { formatSeconds } from '../utils/format'

// Segment blocks are tinted by source clip so the timeline shows structure.
const CLIP_COLORS = ['#ff3d5e', '#3d8bff', '#2ecc8f', '#f5a623', '#b48bff', '#ff7ab8']

interface PlanViewProps {
  plan: EditPlan
  clips: Clip[]
  directorName: string
}

export function PlanView({ plan, clips, directorName }: PlanViewProps) {
  const colorByClip = new Map(clips.map((clip, i) => [clip.id, CLIP_COLORS[i % CLIP_COLORS.length]]))
  const nameByClip = new Map(clips.map((clip) => [clip.id, clip.name]))
  const totalOutput = plan.segments.reduce((sum, s) => sum + s.duration / s.speed, 0)

  return (
    <div className="plan-view">
      <div className="plan-view__reasoning">
        <span className="plan-view__director">{directorName}</span>
        <p>{plan.reasoning}</p>
      </div>

      <div className="plan-view__timeline" role="img" aria-label="Edit timeline">
        {plan.segments.map((segment, i) => (
          <div
            key={i}
            className="plan-view__segment"
            style={{
              flexGrow: segment.duration / segment.speed,
              background: colorByClip.get(segment.clipId),
            }}
            title={`${nameByClip.get(segment.clipId)} — ${segment.start.toFixed(1)}s for ${segment.duration.toFixed(1)}s${segment.speed !== 1 ? ` at ${segment.speed}×` : ''}`}
          />
        ))}
      </div>

      <div className="plan-view__legend">
        {clips
          .filter((clip) => plan.segments.some((s) => s.clipId === clip.id))
          .map((clip) => (
            <span key={clip.id} className="plan-view__legend-item">
              <i style={{ background: colorByClip.get(clip.id) }} />
              {clip.name}
            </span>
          ))}
      </div>

      <dl className="plan-view__stats">
        <div>
          <dt>Length</dt>
          <dd>{formatSeconds(totalOutput)}</dd>
        </div>
        <div>
          <dt>Cuts</dt>
          <dd>{plan.segments.length}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{plan.output.aspectLabel}</dd>
        </div>
        <div>
          <dt>Pacing</dt>
          <dd>{plan.pacing}</dd>
        </div>
        {plan.title && (
          <div>
            <dt>Title</dt>
            <dd>“{plan.title}”</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
