import { fetchFile } from '@ffmpeg/util'
import type { Clip, EditPlan, MusicTrack } from '../types'
import { planTiming, type PlanTiming } from '../utils/plan'
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

interface GraphOptions {
  plan: EditPlan
  timing: PlanTiming
  inputIndexByClip: Map<string, number>
  withSourceAudio: boolean
  titleInputIndex: number | null
  /** Music input index, or null to render without music. */
  musicInputIndex: number | null
  music: MusicTrack | null
}

/** atempo only accepts 0.5–2 per instance; our speeds stay in that range. */
function buildFilterGraph(options: GraphOptions): string {
  const { plan, timing, inputIndexByClip, withSourceAudio, titleInputIndex, musicInputIndex, music } = options
  const { width, height, fps } = plan.output
  const crossfade = plan.transitions === 'crossfade' && plan.segments.length > 1
  const chains: string[] = []

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
    if (withSourceAudio) {
      const audio = [
        `atrim=start=${segment.start}:duration=${segment.duration}`,
        'asetpts=PTS-STARTPTS',
        ...(segment.speed !== 1 ? [`atempo=${segment.speed}`] : []),
        'aresample=44100',
        'aformat=sample_fmts=fltp:channel_layouts=stereo',
      ].join(',')
      chains.push(`[${i}:a]${audio}[a${j}]`)
    }
  })

  const n = plan.segments.length
  if (crossfade) {
    // Fold the segments together with dissolves; offsets accumulate as
    // each fade shortens the running chain.
    let videoLabel = '[v0]'
    let elapsed = timing.outDurations[0]
    for (let j = 1; j < n; j++) {
      const fade = timing.fades[j - 1]
      const next = j === n - 1 ? '[vcat]' : `[vx${j}]`
      chains.push(
        `${videoLabel}[v${j}]xfade=transition=fade:duration=${fade}:offset=${(elapsed - fade).toFixed(3)}${next}`,
      )
      videoLabel = next
      elapsed += timing.outDurations[j] - fade
    }
    if (withSourceAudio) {
      let audioLabel = '[a0]'
      for (let j = 1; j < n; j++) {
        const next = j === n - 1 ? '[acat]' : `[ax${j}]`
        chains.push(`${audioLabel}[a${j}]acrossfade=d=${timing.fades[j - 1]}${next}`)
        audioLabel = next
      }
    }
  } else if (n === 1) {
    chains.push('[v0]null[vcat]')
    if (withSourceAudio) chains.push('[a0]anull[acat]')
  } else {
    const videoInputs = plan.segments.map((_, j) => `[v${j}]`).join('')
    chains.push(`${videoInputs}concat=n=${n}:v=1:a=0[vcat]`)
    if (withSourceAudio) {
      const audioInputs = plan.segments.map((_, j) => `[a${j}]`).join('')
      chains.push(`${audioInputs}concat=n=${n}:v=0:a=1[acat]`)
    }
  }

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
  if (videoLabel !== '[vfinal]') {
    chains.push(`${videoLabel}null[vfinal]`)
  }

  // Audio out: source, music, or both mixed.
  if (musicInputIndex !== null && music) {
    const total = timing.total
    const musicChain = [
      `atrim=duration=${total.toFixed(3)}`,
      `volume=${music.volume.toFixed(2)}`,
      'afade=t=in:st=0:d=1',
      ...(total > 3 ? [`afade=t=out:st=${(total - 1.5).toFixed(3)}:d=1.5`] : []),
      'aresample=44100',
      'aformat=sample_fmts=fltp:channel_layouts=stereo',
    ].join(',')
    if (withSourceAudio) {
      chains.push(`[${musicInputIndex}:a]${musicChain}[mus]`)
      chains.push('[acat][mus]amix=inputs=2:duration=first:normalize=0[aout]')
    } else {
      chains.push(`[${musicInputIndex}:a]${musicChain}[aout]`)
    }
  } else if (withSourceAudio) {
    chains.push('[acat]anull[aout]')
  }

  return chains.join(';')
}

/**
 * Execute an edit plan with ffmpeg.wasm and return the rendered video.
 * Audio is attempted in tiers — source audio mixed with music, music
 * alone, source alone — falling back to a silent render only if every
 * audio graph fails (e.g. clips with no audio stream and no music).
 */
export async function renderPlan(
  plan: EditPlan,
  clips: Clip[],
  music: MusicTrack | null,
  onProgress: (progress: RenderProgress) => void,
): Promise<Blob> {
  onProgress({ ratio: null, message: 'Loading video engine…' })
  const ffmpeg = await getFFmpeg()
  const timing = planTiming(plan)

  const logTail: string[] = []
  const onLog = ({ message }: { message: string }) => {
    logTail.push(message)
    if (logTail.length > 40) logTail.shift()
  }
  const onProg = ({ progress }: { progress: number }) => {
    onProgress({ ratio: Math.min(Math.max(progress, 0), 1), message: 'Rendering…' })
  }
  ffmpeg.on('log', onLog)
  ffmpeg.on('progress', onProg)

  const usedClipIds = new Set(plan.segments.map((s) => s.clipId))
  const usedClips = clips.filter((c) => usedClipIds.has(c.id))
  const inputIndexByClip = new Map<string, number>()
  const clipInputArgs: string[] = []
  const written: string[] = []

  try {
    onProgress({ ratio: null, message: 'Preparing footage…' })
    for (const [i, clip] of usedClips.entries()) {
      const name = `input${i}.${extensionOf(clip.name)}`
      await ffmpeg.writeFile(name, await fetchFile(clip.file))
      written.push(name)
      inputIndexByClip.set(clip.id, i)
      clipInputArgs.push('-i', name)
    }

    let titleInputIndex: number | null = null
    const titleInputArgs: string[] = []
    if (plan.title) {
      const png = await makeTitleCard(plan.title, plan.output.width, plan.output.height)
      await ffmpeg.writeFile('title.png', png)
      written.push('title.png')
      titleInputIndex = usedClips.length
      titleInputArgs.push('-i', 'title.png')
    }

    let musicName: string | null = null
    let musicLoops = 0
    if (music) {
      musicName = `music.${extensionOf(music.name)}`
      await ffmpeg.writeFile(musicName, await fetchFile(music.file))
      written.push(musicName)
      // Loop the track enough times to cover the whole cut.
      musicLoops = music.duration
        ? Math.max(0, Math.ceil(timing.total / music.duration) - 1)
        : 5
    }

    const encodeVideo = [
      '-map', '[vfinal]',
      '-c:v', 'libvpx',
      '-b:v', '2M',
      '-deadline', 'realtime',
      '-cpu-used', '8',
    ]

    const attempts: Array<{ sourceAudio: boolean; useMusic: boolean; label: string }> = music
      ? [
          { sourceAudio: true, useMusic: true, label: 'source audio + music' },
          { sourceAudio: false, useMusic: true, label: 'music only' },
          { sourceAudio: false, useMusic: false, label: 'no audio' },
        ]
      : [
          { sourceAudio: true, useMusic: false, label: 'source audio' },
          { sourceAudio: false, useMusic: false, label: 'no audio' },
        ]

    let code = -1
    for (const attempt of attempts) {
      onProgress({ ratio: 0, message: 'Rendering…' })
      const useMusic = attempt.useMusic && musicName !== null
      const musicInputIndex = useMusic ? usedClips.length + (titleInputIndex !== null ? 1 : 0) : null
      const graph = buildFilterGraph({
        plan,
        timing,
        inputIndexByClip,
        withSourceAudio: attempt.sourceAudio,
        titleInputIndex,
        musicInputIndex,
        music: useMusic ? music : null,
      })
      const hasAudio = attempt.sourceAudio || useMusic
      code = await ffmpeg.exec([
        ...clipInputArgs,
        ...titleInputArgs,
        ...(useMusic ? ['-stream_loop', String(musicLoops), '-i', musicName!] : []),
        '-filter_complex', graph,
        ...encodeVideo,
        ...(hasAudio ? ['-map', '[aout]', '-c:a', 'libvorbis', '-b:a', '128k'] : ['-an']),
        '-y', OUTPUT_NAME,
      ])
      if (code === 0) break
      onProgress({ ratio: 0, message: `Retrying (${attempt.label} failed)…` })
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
