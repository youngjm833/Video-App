import { useRef, useState } from 'react'
import type { MusicTrack } from '../types'
import { formatSeconds } from '../utils/format'

const DEFAULT_VOLUME = 0.3
const SAMPLE_TRACK_URL = '/audio/ambient-loop.ogg'

/** Read the track length via an off-screen <audio>; null if undecodable. */
function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const finish = (duration: number | null) => {
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    const timer = setTimeout(() => finish(null), 5000)
    audio.onerror = () => {
      clearTimeout(timer)
      finish(null)
    }
    audio.onloadedmetadata = () => {
      clearTimeout(timer)
      finish(Number.isFinite(audio.duration) ? audio.duration : null)
    }
    audio.src = url
  })
}

interface MusicPanelProps {
  music: MusicTrack | null
  onChange: (music: MusicTrack | null) => void
}

export function MusicPanel({ music, onChange }: MusicPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const setTrack = async (file: File) => {
    setLoading(true)
    try {
      const duration = await readAudioDuration(file)
      onChange({ file, name: file.name, duration, volume: music?.volume ?? DEFAULT_VOLUME })
    } finally {
      setLoading(false)
    }
  }

  const loadSample = async () => {
    setLoading(true)
    try {
      const response = await fetch(SAMPLE_TRACK_URL)
      if (!response.ok) throw new Error('Failed to load sample track')
      const blob = await response.blob()
      await setTrack(new File([blob], 'ambient-loop.ogg', { type: blob.type || 'audio/ogg' }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="music-panel">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void setTrack(file)
          e.target.value = ''
        }}
      />
      <div className="music-panel__row">
        <span className="music-panel__label">🎵 Soundtrack</span>
        {music ? (
          <>
            <span className="music-panel__track" title={music.name}>
              {music.name}
              {music.duration != null && ` · ${formatSeconds(music.duration)}`}
              {' · loops to fit'}
            </span>
            <label className="music-panel__volume">
              Volume
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(music.volume * 100)}
                onChange={(e) => onChange({ ...music, volume: Number(e.target.value) / 100 })}
              />
              <span>{Math.round(music.volume * 100)}%</span>
            </label>
            <button
              className="icon-button icon-button--danger"
              onClick={() => onChange(null)}
              title="Remove music"
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="music-panel__hint">
              Optional — mixed under the footage, faded in and out, looped to fit.
            </span>
            <button className="button" onClick={() => inputRef.current?.click()} disabled={loading}>
              Choose audio file
            </button>
            <button className="button" onClick={loadSample} disabled={loading}>
              {loading ? 'Loading…' : 'Use sample track'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
