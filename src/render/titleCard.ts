/**
 * Render a title as a transparent PNG with the canvas API, so ffmpeg can
 * overlay it without needing font files inside the wasm filesystem.
 */
export async function makeTitleCard(
  text: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const fontSize = Math.round(Math.min(width / 12, height / 8))
  ctx.font = `700 ${fontSize}px Inter, 'Segoe UI', system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
  ctx.shadowBlur = fontSize / 4
  ctx.shadowOffsetY = fontSize / 16
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, width / 2, height / 2, width * 0.9)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode title card'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}
