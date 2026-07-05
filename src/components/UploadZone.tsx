import { useRef, useState, type DragEvent } from 'react'

interface UploadZoneProps {
  onFiles: (files: File[]) => void
  onLoadSamples: () => void
  loadingSamples: boolean
}

export function UploadZone({ onFiles, onLoadSamples, loadingSamples }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/'))
    if (files.length) onFiles(files)
  }

  return (
    <div
      className={`upload-zone${dragging ? ' upload-zone--dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <p className="upload-zone__headline">Drop raw footage here</p>
      <p className="upload-zone__hint">MP4, WebM, or MOV — as many clips as you like</p>
      <div className="upload-zone__actions">
        <button className="button button--primary" onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <button className="button" onClick={onLoadSamples} disabled={loadingSamples}>
          {loadingSamples ? 'Loading…' : 'Load sample footage'}
        </button>
      </div>
    </div>
  )
}
