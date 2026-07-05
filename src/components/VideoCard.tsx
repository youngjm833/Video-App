import type { Video } from '../types'
import { formatDate, formatViews } from '../utils/format'

interface VideoCardProps {
  video: Video
  onSelect: (video: Video) => void
}

export function VideoCard({ video, onSelect }: VideoCardProps) {
  return (
    <article className="video-card" onClick={() => onSelect(video)}>
      <div className="video-card__thumb">
        <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        <span className="video-card__duration">{video.duration}</span>
      </div>
      <div className="video-card__info">
        <h3 className="video-card__title">{video.title}</h3>
        <p className="video-card__channel">{video.channel}</p>
        <p className="video-card__meta">
          {formatViews(video.views)} · {formatDate(video.uploadedAt)}
        </p>
      </div>
    </article>
  )
}
