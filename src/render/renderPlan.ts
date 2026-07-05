import { fetchFile } from '@ffmpeg/util'
import type { Clip, EditPlan } from '../types'
import { getFFmpeg } from './ffmpeg'
import { makeTitleCard } from './titleCard'

export interface RenderProgress {
  /** 0..1, or null while ffmpeg hasn't reported progress yet. */
  ratio: number | null
  message: string
}

const OUTPUT_NAME = 'output.webm'
const TITLE_SECONDS = 2.5

function extensionOf(name: string): string {
  const match = name.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : 'mp4'
}

/** atempo only accepts 0.5–2 per instance; our speeds stay in that range. */
function buildFilterGraph(plan: EditPlan, inputIndexByClip: Map<string, number>, withAudio: boolean, titleInputIndex: number | null): string {
  const { width, height, fps } = plan.output
  const chains: string[] = []
  const concatInputs: string[] = []

  plan.segments.forEach((segment, j) => {
    const i = inputIndexByClip.get(segment.clipId)
    const video = [
      `trim=start=${segment.start}:duration=${segment.duration}`,
      `setpts=(PTS-STARTPTS)/${segment.speed}`,
      `fps=${fps}`,
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
      'setsar=1',
      'format=yuv420p',
    ].join(',')
    chains.push(`[${i}:v]${video}[v${j}]`)
    concatInputs.push(`[v${j}]`)
    if (withAudio) {
      const audio = [
        `atrim=start=${segment.start}:duration=${segment.duration}`,
        'asetpts=PTS-STARTPTS',
        ...(segment.speed !== 1 ? [`atempo=${segment.speed}`] : []),
        'aresample=44100',
        'aformat=sample_fmts=fltp:channel_layouts=stereo',
      ].join(',')
      chains.push(`[${i}:a]${audio}[a${j}]`)
      concatInputs.push(`[a${j}]`)
    }
  })

  const n = plan.segments.length
  chains.push(
    `${concatInputs.join('')}concat=n=${n}:v=1:a=${withAudio ? 1 : 0}${withAudio ? '[vcat][acat]' : '[vcat]'}`,
  )

  const post: string[] = []
  if (plan.filters.grade) post.push('eq=contrast=1.12:saturation=1.3')
  if (plan.filters.monochrome) post.push('hue=s=0')
  if (plan.filters.letterbox) {
    const bar = Math.round(height * 0.12)
    post.push(
      `drawbox=x=0:y=0:w=iw:h=${bar}:color=black:t=fill`,
      `drawbox=x=0:y=ih-${bar}:w=iw:h=${bar}:color=black:t=fill`,
    )
  }

  let videoLabel = '[vcat]'
  if (post.length > 0) {
    chains.push(`${videoLabel}${post.join(',')}[vfx]`)
    videoLabel = '[vfx]'
  }
  if (titleInputIndex !== null) {
    chains.push(`${videoLabel}[${titleInputIndex}:v]overlay=(W-w)/2:(H-h)/2:enable='lte(t,${TITLE_SECONDS})'[vtitle]`)
    videoLabel = '[vtitle]'
  }
  // Give the final label a fixed name so -map is stable.
  if (videoLabel !== '[vfinal]') {
    chains.push(`${videoLabel}null[vfinal]`)
  }
  return chains.join(';')
}

/**
 * Execute an edit plan with ffmpeg.wasm and return the rendered video.
 * Tries to carry source audio through; if any clip has no audio stream
 * (or the audio graph fails), falls back to a video-only render.
 */
export async function renderPlan(
  plan: EditPlan,
  clips: Clip[],
  onProgress: (progress: RenderProgress) => void,
): Promise<Blob> {
  onProgress({ ratio: null, message: 'Loading video engine…' })
  const ffmpeg = await getFFmpeg()

  const logTail: string[] = []
  const onLog = ({ message }: { message: string }) => {
    logTail.push(message)
    if (logTail.length > 40) logTail.shift()
  }
  const onProg = ({ progress }: { progress: number }) => {
    // ffmpeg occasionally reports slightly >1 at the end.
    onProgress({ ratio: Math.min(Math.max(progress, 0), 1), message: 'Rendering…' })
  }
  ffmpeg.on('log', onLog)
  ffmpeg.on('progress', onProg)

  const usedClipIds = new Set(plan.segments.map((s) => s.clipId))
  const usedClips = clips.filter((c) => usedClipIds.has(c.id))
  const inputIndexByClip = new Map<string, number>()
  const inputArgs: string[] = []
  const written: string[] = []

  try {
    onProgress({ ratio: null, message: 'Preparing footage…' })
    for (const [i, clip] of usedClips.entries()) {
      const name = `input${i}.${extensionOf(clip.name)}`
      await ffmpeg.writeFile(name, await fetchFile(clip.file))
      written.push(name)
      inputIndexByClip.set(clip.id, i)
      inputArgs.push('-i', name)
    }

    let titleInputIndex: number | null = null
    if (plan.title) {
      const png = await makeTitleCard(plan.title, plan.output.width, plan.output.height)
      await ffmpeg.writeFile('title.png', png)
      written.push('title.png')
      titleInputIndex = usedClips.length
      inputArgs.push('-i', 'title.png')
    }

    const encode = [
      '-map', '[vfinal]',
      '-c:v', 'libvpx',
      '-b:v', '2M',
      '-deadline', 'realtime',
      '-cpu-used', '8',
    ]

    onProgress({ ratio: 0, message: 'Rendering…' })
    const withAudioGraph = buildFilterGraph(plan, inputIndexByClip, true, titleInputIndex)
    let code = await ffmpeg.exec([
      ...inputArgs,
      '-filter_complex', withAudioGraph,
      ...encode,
      '-map', '[acat]',
      '-c:a', 'libvorbis',
      '-b:a', '128k',
      '-y', OUTPUT_NAME,
    ])

    if (code !== 0) {
      onProgress({ ratio: 0, message: 'Rendering (no audio track found)…' })
      const videoOnlyGraph = buildFilterGraph(plan, inputIndexByClip, false, titleInputIndex)
      code = await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex', videoOnlyGraph,
        ...encode,
        '-an',
        '-y', OUTPUT_NAME,
      ])
    }

    if (code !== 0) {
      throw new Error(`Render failed (ffmpeg exit ${code}).\n${logTail.slice(-12).join('\n')}`)
    }

    onProgress({ ratio: 1, message: 'Finalizing…' })
    const data = await ffmpeg.readFile(OUTPUT_NAME)
    if (typeof data === 'string') throw new Error('Unexpected text output from ffmpeg')
    return new Blob([new Uint8Array(data as Uint8Array)], { type: 'video/webm' })
  } finally {
    ffmpeg.off('log', onLog)
    ffmpeg.off('progress', onProg)
    for (const name of [...written, OUTPUT_NAME]) {
      try {
        await ffmpeg.deleteFile(name)
      } catch {
        // Best-effort cleanup; the file may not exist on failure paths.
      }
    }
  }
}
