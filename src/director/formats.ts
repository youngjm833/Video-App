import type { OutputFormat } from '../types'

export const LANDSCAPE: OutputFormat = {
  width: 1280,
  height: 720,
  fps: 30,
  aspectLabel: '16:9 landscape',
}

export const PORTRAIT: OutputFormat = {
  width: 720,
  height: 1280,
  fps: 30,
  aspectLabel: '9:16 vertical',
}

export const SQUARE: OutputFormat = {
  width: 720,
  height: 720,
  fps: 30,
  aspectLabel: '1:1 square',
}

export type AspectName = 'landscape' | 'portrait' | 'square'

export const FORMAT_BY_ASPECT: Record<AspectName, OutputFormat> = {
  landscape: LANDSCAPE,
  portrait: PORTRAIT,
  square: SQUARE,
}
