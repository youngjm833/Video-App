import type { Clip } from '../types'

export interface SampledFrame {
  /** Timestamp within the clip, seconds. */
  time: number
  /** Base64 JPEG data (no data-URL prefix). */
  base64: string
}

const FRAME_WIDTH = 512
const JPEG_QUALITY = 0.6
const SEEK_TIMEOUT_MS = 5000

/**
 * Capture evenly spaced frames from a clip so a vision model can see the
 * footage. Returns [] when the browser can't decode the clip's codec —
 * the director then falls back to metadata-only planning for that clip.
 */
export async function sampleFrames(clip: Clip, count: number): Promise<SampledFrame[]> {
  const url = URL.createObjectURL(clip.file)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'

  try {
    const duration = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), SEEK_TIMEOUT_MS)
      video.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }
      video.onloadedmetadata = () => {
        clearTimeout(timer)
        resolve(Number.isFinite(video.duration) ? video.duration : null)
      }
      video.src = url
    })
    if (duration === null) return []

    const canvas = document.createElement('canvas')
    const scale = FRAME_WIDTH / (video.videoWidth || FRAME_WIDTH)
    canvas.width = Math.round((video.videoWidth || FRAME_WIDTH) * scale)
    canvas.height = Math.max(1, Math.round((video.videoHeight || 288) * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return []

    const frames: SampledFrame[] = []
    for (let i = 0; i < count; i++) {
      // Midpoints of even slices, so frames represent the whole clip.
      const time = ((i + 0.5) / count) * duration
      const seeked = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), SEEK_TIMEOUT_MS)
        video.onseeked = () => {
          clearTimeout(timer)
          resolve(true)
        }
        video.onerror = () => {
          clearTimeout(timer)
          resolve(false)
        }
        video.currentTime = time
      })
      if (!seeked) continue
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        frames.push({ time: Math.round(time * 10) / 10, base64: dataUrl.split(',')[1] })
      } catch {
        // Tainted canvas or decode hiccup — skip this frame.
      }
    }
    return frames
  } finally {
    video.removeAttribute('src')
    URL.revokeObjectURL(url)
  }
}

/** Frames per clip, scaled to clip length and capped for request size. */
export function framesForClip(clip: Clip): number {
  const duration = clip.duration ?? 10
  return Math.max(2, Math.min(6, Math.ceil(duration / 6)))
}
