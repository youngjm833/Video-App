import type { Video } from '../types'
import { formatDate, formatViews } from '../utils/format'
import { VideoCard } from './VideoCard'

interface VideoPlayerProps {
  video: Video
  relatedVideos: Video[]
  onSelect: (video: Video) => void
  onBack: () => void
}

export function VideoPlayer({ video, relatedVideos, onSelect, onBack }: VideoPlayerProps) {
  return (
    <div className="player-page">
      <div className="player-page__main">
        <button className="player-page__back" onClick={onBack}>
          ← Back to browse
        </button>
        <div className="player-page__video">
          <video key={video.id} poster={video.thumbnailUrl} controls autoPlay>
            <source src={video.webmUrl} type="video/webm" />
            <source src={video.videoUrl} type="video/mp4" />
          </video>
        </div>
        <h1 className="player-page__title">{video.title}</h1>
        <div className="player-page__meta">
          <span className="player-page__channel">{video.channel}</span>
          <span>
            {formatViews(video.views)} · {formatDate(video.uploadedAt)}
          </span>
          <span className="player-page__category">{video.category}</span>
        </div>
        <p className="player-page__description">{video.description}</p>
      </div>
      <aside className="player-page__related">
        <h2>Up next</h2>
        {relatedVideos.map((related) => (
          <VideoCard key={related.id} video={related} onSelect={onSelect} />
        ))}
      </aside>
    </div>
  )
}
