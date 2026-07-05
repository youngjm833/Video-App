import type { RenderProgress } from '../render/renderPlan'

interface RenderPanelProps {
  status: 'idle' | 'rendering' | 'done' | 'error'
  progress: RenderProgress | null
  outputUrl: string | null
  error: string | null
  onRender: () => void
}

export function RenderPanel({ status, progress, outputUrl, error, onRender }: RenderPanelProps) {
  return (
    <div className="render-panel">
      {status !== 'rendering' && (
        <button className="button button--primary button--large" onClick={onRender}>
          {status === 'done' ? 'Render again' : 'Render video'}
        </button>
      )}

      {status === 'rendering' && (
        <div className="render-panel__progress">
          <div className="progress-bar">
            <div
              className={`progress-bar__fill${progress?.ratio === null ? ' progress-bar__fill--indeterminate' : ''}`}
              style={progress?.ratio != null ? { width: `${Math.round(progress.ratio * 100)}%` } : undefined}
            />
          </div>
          <span className="render-panel__status">
            {progress?.message ?? 'Rendering…'}
            {progress?.ratio != null ? ` ${Math.round(progress.ratio * 100)}%` : ''}
          </span>
        </div>
      )}

      {status === 'error' && error && <p className="render-panel__error">{error}</p>}

      {status === 'done' && outputUrl && (
        <div className="render-panel__result">
          <video src={outputUrl} controls autoPlay loop />
          <a className="button" href={outputUrl} download="edited-video.webm">
            Download video
          </a>
        </div>
      )}
    </div>
  )
}
