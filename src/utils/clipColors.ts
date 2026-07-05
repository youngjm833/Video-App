import type { Clip } from '../types'

/** Segment blocks and editor rows are tinted by source clip. */
export const CLIP_COLORS = ['#ff3d5e', '#3d8bff', '#2ecc8f', '#f5a623', '#b48bff', '#ff7ab8']

export function clipColorMap(clips: Clip[]): Map<string, string> {
  return new Map(clips.map((clip, i) => [clip.id, CLIP_COLORS[i % CLIP_COLORS.length]]))
}
