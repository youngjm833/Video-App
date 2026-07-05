import { useMemo, useState } from 'react'
import { CategoryFilter } from './components/CategoryFilter'
import { Header } from './components/Header'
import { VideoGrid } from './components/VideoGrid'
import { VideoPlayer } from './components/VideoPlayer'
import { videos } from './data/videos'
import type { CategoryFilterValue, Video } from './types'

export default function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilterValue>('All')
  const [activeVideo, setActiveVideo] = useState<Video | null>(null)

  const filteredVideos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return videos.filter((video) => {
      const matchesCategory = category === 'All' || video.category === category
      const matchesQuery =
        query === '' ||
        video.title.toLowerCase().includes(query) ||
        video.channel.toLowerCase().includes(query) ||
        video.description.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [searchQuery, category])

  const relatedVideos = useMemo(() => {
    if (!activeVideo) return []
    const sameCategory = videos.filter(
      (v) => v.id !== activeVideo.id && v.category === activeVideo.category,
    )
    const others = videos.filter(
      (v) => v.id !== activeVideo.id && v.category !== activeVideo.category,
    )
    return [...sameCategory, ...others].slice(0, 6)
  }, [activeVideo])

  const openVideo = (video: Video) => {
    setActiveVideo(video)
    window.scrollTo({ top: 0 })
  }

  const goHome = () => {
    setActiveVideo(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="app">
      <Header
        searchQuery={searchQuery}
        onSearchChange={(query) => {
          setSearchQuery(query)
          setActiveVideo(null)
        }}
        onHome={goHome}
      />
      <main className="app__content">
        {activeVideo ? (
          <VideoPlayer
            video={activeVideo}
            relatedVideos={relatedVideos}
            onSelect={openVideo}
            onBack={goHome}
          />
        ) : (
          <>
            <CategoryFilter selected={category} onSelect={setCategory} />
            <VideoGrid videos={filteredVideos} onSelect={openVideo} />
          </>
        )}
      </main>
    </div>
  )
}
