export interface Video {
  id: string
  title: string
  description: string
  videoUrl: string
  webmUrl: string
  thumbnailUrl: string
  duration: string
  category: Category
  channel: string
  views: number
  uploadedAt: string
}

export const CATEGORIES = [
  'All',
  'Fractals',
  'Generative',
  'Test Patterns',
] as const

export type Category = Exclude<(typeof CATEGORIES)[number], 'All'>
export type CategoryFilterValue = (typeof CATEGORIES)[number]
