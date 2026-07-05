import type { Clip } from '../types'
import { formatBytes, formatSeconds } from '../utils/format'

interface ClipListProps {
  clips: Clip[]
  onRemove: (id: string) => void
}

export function ClipList({ clips, onRemove }: ClipListProps) {
  if (clips.length === 0) return null
  return (
    <ul className="clip-list">
      {clips.map((clip) => (
        <li key={clip.id} className="clip-card">
          <div className="clip-card__thumb">
            {clip.thumbnail ? (
              <img src={clip.thumbnail} alt="" />
            ) : (
              <span className="clip-card__thumb-fallback">🎞</span>
            )}
            <span className="clip-card__duration">{formatSeconds(clip.duration)}</span>
          </div>
          <div className="clip-card__info">
            <span className="clip-card__name" title={clip.name}>
              {clip.name}
            </span>
            <span className="clip-card__meta">
              {clip.width && clip.height ? `${clip.width}×${clip.height} · ` : ''}
              {formatBytes(clip.file.size)}
            </span>
          </div>
          <button
            className="clip-card__remove"
            onClick={() => onRemove(clip.id)}
            aria-label={`Remove ${clip.name}`}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
