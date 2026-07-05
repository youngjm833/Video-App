import type { Clip } from '../types'

let nextId = 0

interface VideoMetadata {
  duration: number | null
  width: number | null
  height: number | null
  thumbnail: string | null
}

/**
 * Read duration/dimensions and grab a poster frame via an off-screen
 * <video>. Falls back to nulls when the browser can't decode the codec —
 * the editor still works, it just assumes a default clip length.
 */
function readMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.muted = true
    video.preload = 'auto'
    const fallback: VideoMetadata = { duration: null, width: null, height: null, thumbnail: null }

    const finish = (meta: VideoMetadata) => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      resolve(meta)
    }
    const timer = setTimeout(() => finish(fallback), 8000)

    video.onerror = () => {
      clearTimeout(timer)
      finish(fallback)
    }
    video.onloadedmetadata = () => {
      // Seek a little in so the poster isn't a black lead-in frame.
      video.currentTime = Math.min(video.duration * 0.15 || 0, 3)
    }
    video.onseeked = () => {
      clearTimeout(timer)
      let thumbnail: string | null = null
      try {
        const canvas = document.createElement('canvas')
        const scale = 320 / (video.videoWidth || 320)
        canvas.width = Math.round((video.videoWidth || 320) * scale)
        canvas.height = Math.round((video.videoHeight || 180) * scale)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          thumbnail = canvas.toDataURL('image/jpeg', 0.7)
        }
      } catch {
        // Tainted canvas or decode issue — thumbnail stays null.
      }
      finish({
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        thumbnail,
      })
    }
    video.src = url
  })
}

export async function fileToClip(file: File): Promise<Clip> {
  const meta = await readMetadata(file)
  return {
    id: `clip-${nextId++}`,
    file,
    name: file.name,
    ...meta,
  }
}

/** Bundled demo footage so the editor can be tried without any uploads. */
export const SAMPLE_FOOTAGE = [
  { url: '/videos/mandelbrot-descent.webm', name: 'mandelbrot-descent.webm' },
  { url: '/videos/conways-garden.webm', name: 'conways-garden.webm' },
  { url: '/videos/plasma-waves.webm', name: 'plasma-waves.webm' },
  { url: '/videos/aurora-fade.webm', name: 'aurora-fade.webm' },
]

export async function loadSampleFootage(): Promise<Clip[]> {
  const clips = await Promise.all(
    SAMPLE_FOOTAGE.map(async ({ url, name }) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to load sample ${name}`)
      const blob = await response.blob()
      return fileToClip(new File([blob], name, { type: blob.type || 'video/webm' }))
    }),
  )
  return clips
}
