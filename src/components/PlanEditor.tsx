import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Clip, EditPlan, Segment } from '../types'
import { clipColorMap } from '../utils/clipColors'

const MIN_SEGMENT_SECONDS = 0.5
const FALLBACK_CLIP_DURATION = 10
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function durationOf(clip: Clip | undefined): number {
  return clip?.duration ?? FALLBACK_CLIP_DURATION
}

/* ------------------------------------------------------------------ */

interface TrimBarProps {
  clipDuration: number
  start: number
  duration: number
  color: string
  onChange: (start: number, duration: number) => void
}

/**
 * Visual trim control: the track is the full source clip, the tinted
 * window is the kept segment. Drag the edge handles to trim, drag the
 * window body to slide the cut along the clip.
 */
function TrimBar({ clipDuration, start, duration, color, onChange }: TrimBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    mode: 'left' | 'right' | 'move'
    originX: number
    origStart: number
    origDuration: number
  } | null>(null)

  const beginDrag = (mode: 'left' | 'right' | 'move') => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, originX: e.clientX, origStart: start, origDuration: duration }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current || !trackRef.current) return
    const { mode, originX, origStart, origDuration } = drag.current
    const secondsPerPixel = clipDuration / trackRef.current.clientWidth
    const delta = (e.clientX - originX) * secondsPerPixel

    if (mode === 'left') {
      const newStart = clamp(origStart + delta, 0, origStart + origDuration - MIN_SEGMENT_SECONDS)
      onChange(round1(newStart), round1(origDuration + (origStart - newStart)))
    } else if (mode === 'right') {
      const newDuration = clamp(origDuration + delta, MIN_SEGMENT_SECONDS, clipDuration - origStart)
      onChange(round1(origStart), round1(newDuration))
    } else {
      const newStart = clamp(origStart + delta, 0, clipDuration - origDuration)
      onChange(round1(newStart), round1(origDuration))
    }
  }

  const endDrag = () => {
    drag.current = null
  }

  return (
    <div className="trim-bar" ref={trackRef}>
      <div
        className="trim-bar__window"
        style={{
          left: `${(start / clipDuration) * 100}%`,
          width: `${(duration / clipDuration) * 100}%`,
          background: color,
        }}
        onPointerDown={beginDrag('move')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span
          className="trim-bar__handle trim-bar__handle--left"
          onPointerDown={beginDrag('left')}
          aria-label="Trim start"
        />
        <span
          className="trim-bar__handle trim-bar__handle--right"
          onPointerDown={beginDrag('right')}
          aria-label="Trim end"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

interface SegmentRowProps {
  segment: Segment
  index: number
  total: number
  clips: Clip[]
  color: string
  onChange: (segment: Segment) => void
  onMove: (from: number, to: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  dropTarget: boolean
}

function SegmentRow({
  segment,
  index,
  total,
  clips,
  color,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  dropTarget,
}: SegmentRowProps) {
  const clip = clips.find((c) => c.id === segment.clipId)
  const clipDuration = durationOf(clip)
  const [previewing, setPreviewing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const previewUrl = useMemo(
    () => (previewing && clip ? URL.createObjectURL(clip.file) : null),
    [previewing, clip],
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Keep the preview inside the trimmed window, looping, at segment speed.
  const syncPreview = () => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = segment.speed
    if (video.currentTime < segment.start || video.currentTime >= segment.start + segment.duration) {
      video.currentTime = segment.start
    }
  }

  const changeClip = (clipId: string) => {
    const next = clips.find((c) => c.id === clipId)
    if (!next) return
    const total = durationOf(next)
    const duration = clamp(segment.duration, MIN_SEGMENT_SECONDS, total)
    onChange({
      ...segment,
      clipId,
      start: clamp(segment.start, 0, total - duration),
      duration,
      note: undefined,
    })
  }

  return (
    <li
      className={`segment-row${dropTarget ? ' segment-row--drop-target' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
    >
      <div className="segment-row__grip" title="Drag to reorder" style={{ background: color }}>
        <span>{index + 1}</span>
      </div>

      <div className="segment-row__body">
        <div className="segment-row__top">
          <select
            className="segment-row__clip"
            value={segment.clipId}
            onChange={(e) => changeClip(e.target.value)}
            aria-label="Source clip"
          >
            {clips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="segment-row__timing">
            {segment.start.toFixed(1)}s – {(segment.start + segment.duration).toFixed(1)}s
            <strong> · {(segment.duration / segment.speed).toFixed(1)}s in cut</strong>
          </span>
          <select
            className="segment-row__speed"
            value={segment.speed}
            onChange={(e) => onChange({ ...segment, speed: Number(e.target.value) })}
            aria-label="Playback speed"
          >
            {SPEED_OPTIONS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </div>

        <TrimBar
          clipDuration={clipDuration}
          start={segment.start}
          duration={segment.duration}
          color={color}
          onChange={(start, duration) => onChange({ ...segment, start, duration })}
        />

        {segment.note && <p className="segment-row__note">“{segment.note}”</p>}

        {previewing && clip && previewUrl && (
          <video
            ref={videoRef}
            className="segment-row__preview"
            src={previewUrl}
            muted
            autoPlay
            onLoadedMetadata={syncPreview}
            onTimeUpdate={syncPreview}
          />
        )}
      </div>

      <div className="segment-row__actions">
        <button
          className={`icon-button${previewing ? ' icon-button--active' : ''}`}
          onClick={() => setPreviewing((p) => !p)}
          title={previewing ? 'Close preview' : 'Preview this cut'}
        >
          {previewing ? '■' : '▶'}
        </button>
        <button
          className="icon-button"
          onClick={() => onMove(index, index - 1)}
          disabled={index === 0}
          title="Move earlier"
        >
          ↑
        </button>
        <button
          className="icon-button"
          onClick={() => onMove(index, index + 1)}
          disabled={index === total - 1}
          title="Move later"
        >
          ↓
        </button>
        <button className="icon-button" onClick={onDuplicate} title="Duplicate cut">
          ⧉
        </button>
        <button className="icon-button icon-button--danger" onClick={onDelete} title="Delete cut">
          ✕
        </button>
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */

interface PlanEditorProps {
  plan: EditPlan
  clips: Clip[]
  onChange: (plan: EditPlan) => void
}

export function PlanEditor({ plan, clips, onChange }: PlanEditorProps) {
  const colors = clipColorMap(clips)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const setSegments = (segments: Segment[]) => onChange({ ...plan, segments })

  const moveSegment = (from: number, to: number) => {
    if (to < 0 || to >= plan.segments.length || from === to) return
    const segments = [...plan.segments]
    const [moved] = segments.splice(from, 1)
    segments.splice(to, 0, moved)
    setSegments(segments)
  }

  const addCut = () => {
    const source = clips.find((c) => c.id === plan.segments.at(-1)?.clipId) ?? clips[0]
    if (!source) return
    const total = durationOf(source)
    const duration = Math.min(3, total)
    setSegments([
      ...plan.segments,
      {
        clipId: source.id,
        start: round1(clamp(total * 0.25, 0, total - duration)),
        duration: round1(duration),
        speed: 1,
      },
    ])
  }

  return (
    <div className="plan-editor">
      <ul className="plan-editor__list">
        {plan.segments.map((segment, i) => (
          <SegmentRow
            key={i}
            segment={segment}
            index={i}
            total={plan.segments.length}
            clips={clips}
            color={colors.get(segment.clipId) ?? '#666'}
            onChange={(next) =>
              setSegments(plan.segments.map((s, j) => (j === i ? next : s)))
            }
            onMove={moveSegment}
            onDuplicate={() =>
              setSegments([
                ...plan.segments.slice(0, i + 1),
                { ...segment },
                ...plan.segments.slice(i + 1),
              ])
            }
            onDelete={() => setSegments(plan.segments.filter((_, j) => j !== i))}
            onDragStart={() => setDragIndex(i)}
            onDragOver={() => setDropIndex(i)}
            onDrop={() => {
              if (dragIndex !== null && dropIndex !== null) moveSegment(dragIndex, dropIndex)
              setDragIndex(null)
              setDropIndex(null)
            }}
            dropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
          />
        ))}
      </ul>
      <button className="button plan-editor__add" onClick={addCut}>
        + Add cut
      </button>
    </div>
  )
}
