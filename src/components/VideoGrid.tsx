import type { Video } from '../types'
import { VideoCard } from './VideoCard'

interface VideoGridProps {
  videos: Video[]
  onSelect: (video: Video) => void
}

export function VideoGrid({ videos, onSelect }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <p>No videos match your search.</p>
      </div>
    )
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onSelect={onSelect} />
      ))}
    </div>
  )
}
