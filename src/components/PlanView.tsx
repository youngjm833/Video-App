import type { Clip, EditPlan } from '../types'
import { clipColorMap } from '../utils/clipColors'
import { formatSeconds } from '../utils/format'
import { PlanEditor } from './PlanEditor'

interface PlanViewProps {
  plan: EditPlan
  clips: Clip[]
  directorName: string
  onChange: (plan: EditPlan) => void
}

export function PlanView({ plan, clips, directorName, onChange }: PlanViewProps) {
  const colorByClip = clipColorMap(clips)
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
            title={`${nameByClip.get(segment.clipId)} — ${segment.start.toFixed(1)}s for ${segment.duration.toFixed(1)}s${segment.speed !== 1 ? ` at ${segment.speed}×` : ''}${segment.note ? ` — ${segment.note}` : ''}`}
          />
        ))}
        {plan.segments.length === 0 && (
          <span className="plan-view__timeline-empty">No cuts left — add one below.</span>
        )}
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

      <PlanEditor plan={plan} clips={clips} onChange={onChange} />
    </div>
  )
}
