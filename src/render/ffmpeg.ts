import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

/** Load the ffmpeg.wasm singleton (~32 MB wasm, fetched once and cached). */
export function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance)
  if (!loading) {
    const ffmpeg = new FFmpeg()
    loading = ffmpeg.load({ coreURL, wasmURL }).then(() => {
      instance = ffmpeg
      return ffmpeg
    })
  }
  return loading
}
