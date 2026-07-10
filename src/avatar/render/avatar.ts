import { getContext, renderResultFromCanvas } from '../../shared/render/canvas'
import { createRuntimeCanvas } from '../../shared/render/runtime'
import {
  normalizeAvatarControls,
  type AvatarControls,
} from '../config/defaults'
import { AVATAR_STYLES } from '../config/styles'

export interface RenderAvatarOptions {
  antialiasScale?: number
}

interface AvatarLine {
  text: string
  y: number
  width: number
}

interface AvatarPaint {
  gradient: CanvasGradient
  solid: string
}

const MAX_LINES = 4
const OUTLINE_STROKE_RATIO = 0.028
const LINE_HEIGHT_RATIO = 1.12
const TEXT_RADIUS_RATIO = 0.96
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif'

export async function renderAvatar(
  input: Partial<AvatarControls> | string,
  options: RenderAvatarOptions = {},
) {
  const controls = normalizeAvatarControls(
    typeof input === 'string' ? { text: input } : input,
  )
  const text = controls.text
  if (!hasAvatarText(text)) {
    throw new Error('Text is required for avatar export.')
  }

  const scale = options.antialiasScale ?? controls.antialiasScale
  const size = Math.round(controls.size)
  const workSize = Math.max(1, Math.round(size * scale))
  const canvas = createRuntimeCanvas(workSize, workSize)
  const context = getContext(canvas)
  const center = workSize / 2
  const radius = workSize / 2

  const paint = createAvatarPaint(context, controls, center, radius)
  drawBackground(context, controls, center, radius, workSize, paint)
  drawText(context, text, controls, center, radius, paint)

  if (scale === 1) {
    return renderResultFromCanvas(canvas)
  }

  const output = createRuntimeCanvas(size, size)
  const outputContext = getContext(output)
  outputContext.imageSmoothingEnabled = true
  outputContext.imageSmoothingQuality = 'high'
  outputContext.drawImage(canvas, 0, 0, size, size)
  return renderResultFromCanvas(output)
}

function drawBackground(
  context: OffscreenCanvasRenderingContext2D,
  controls: AvatarControls,
  center: number,
  radius: number,
  size: number,
  paint: AvatarPaint,
): void {
  context.fillStyle = controls.mode === 'outline' ? '#ffffff' : paint.gradient
  context.fillRect(0, 0, size, size)

  if (controls.mode === 'outline') {
    const lineWidth = Math.max(2, size * OUTLINE_STROKE_RATIO)
    context.lineWidth = lineWidth
    context.strokeStyle = paint.solid
    context.beginPath()
    context.arc(center, center, radius - lineWidth / 2, 0, Math.PI * 2)
    context.stroke()
  }
}

function drawText(
  context: OffscreenCanvasRenderingContext2D,
  text: string,
  controls: AvatarControls,
  center: number,
  radius: number,
  paint: AvatarPaint,
): void {
  const safeRadius = radius * (controls.mode === 'outline' ? 0.78 : 0.86)
  const maxFontSize = safeRadius
  const minFontSize = Math.max(10, radius * 0.12)
  let best = layoutText(context, text, minFontSize, safeRadius)

  let low = minFontSize
  let high = maxFontSize
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const fontSize = (low + high) / 2
    const layout = layoutText(context, text, fontSize, safeRadius)
    if (layout) {
      best = layout
      low = fontSize
    } else {
      high = fontSize
    }
  }
  if (!best) return

  context.save()
  context.translate(center, center)
  context.rotate((controls.rotation * Math.PI) / 180)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = controls.mode === 'outline' ? paint.solid : '#ffffff'
  context.font = fontSpec(best.fontSize)

  for (const line of best.lines) {
    context.fillText(line.text, 0, line.y)
  }
  context.restore()
}

function createAvatarPaint(
  context: OffscreenCanvasRenderingContext2D,
  controls: AvatarControls,
  center: number,
  radius: number,
): AvatarPaint {
  const angle = ((controls.gradientAngle - 90) * Math.PI) / 180
  const dx = Math.cos(angle) * radius
  const dy = Math.sin(angle) * radius
  const gradient = context.createLinearGradient(
    center - dx,
    center - dy,
    center + dx,
    center + dy,
  )
  const style = AVATAR_STYLES[controls.style]

  style.stops.forEach((stop, index, list) => {
    const position = list.length === 1 ? 0 : index / (list.length - 1)
    gradient.addColorStop(position, stop.srgb)
  })

  return { gradient, solid: style.solid }
}

function layoutText(
  context: OffscreenCanvasRenderingContext2D,
  text: string,
  fontSize: number,
  radius: number,
): { fontSize: number; lines: AvatarLine[] } | null {
  context.font = fontSpec(fontSize)
  const manualLines = manualLineTexts(text)
  if (manualLines) {
    const lines = layoutManualLines(context, manualLines, fontSize, radius)
    return lines ? { fontSize, lines } : null
  }

  const graphemes = splitGraphemes(normalizeLineBreaks(text))
  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const maxLines = Math.min(MAX_LINES, Math.max(1, graphemes.length))
  const preferredLines = preferredLineCount(graphemes.length, maxLines)
  let best: AvatarLine[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let lineCount = preferredLines; lineCount <= maxLines; lineCount += 1) {
    const lines = chooseAutoLines(context, graphemes, lineHeight, lineCount, radius)
    if (!lines) continue

    const score = layoutScore(lines, radius, lineHeight)
    if (score < bestScore) {
      best = lines
      bestScore = score
    }
  }
  if (best) return { fontSize, lines: best }

  for (let lineCount = preferredLines - 1; lineCount >= 1; lineCount -= 1) {
    const lines = chooseAutoLines(context, graphemes, lineHeight, lineCount, radius)
    if (lines) return { fontSize, lines }
  }
  return null
}

function manualLineTexts(text: string): string[] | null {
  const hasLineBreak = /\r|\n/.test(text)
  const visibleLength = splitGraphemes(text.replace(/\s+/g, '')).length
  if (!hasLineBreak && visibleLength > 3) return null

  const lines = hasLineBreak
    ? text.split(/\r\n|\r|\n/)
    : [text]
  return lines.length > 0 ? lines : null
}

function layoutManualLines(
  context: OffscreenCanvasRenderingContext2D,
  lineTexts: string[],
  fontSize: number,
  radius: number,
): AvatarLine[] | null {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO
  const lines = lineTexts.map((text, index) => ({
    text,
    y: lineY(index, lineTexts.length, lineHeight),
    width: measureText(context, text),
  }))

  for (const line of lines) {
    if (line.width > lineLimit(radius, line.y, lineHeight)) {
      return null
    }
  }
  return lines
}

function chooseAutoLines(
  context: OffscreenCanvasRenderingContext2D,
  graphemes: string[],
  lineHeight: number,
  lineCount: number,
  radius: number,
): AvatarLine[] | null {
  let best: AvatarLine[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  function visit(start: number, lineIndex: number, lines: AvatarLine[]): void {
    const remainingLines = lineCount - lineIndex
    const remainingChars = graphemes.length - start
    if (remainingChars < remainingLines) return

    if (remainingLines === 1) {
      const line = createLine(context, graphemes, start, graphemes.length, lineIndex, lineCount, lineHeight)
      if (!line || line.width > lineLimit(radius, line.y, lineHeight)) return

      const candidate = [...lines, line]
      const score = layoutScore(candidate, radius, lineHeight)
      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
      return
    }

    const y = lineY(lineIndex, lineCount, lineHeight)
    const maxWidth = lineLimit(radius, y, lineHeight)
    const maxEnd = graphemes.length - remainingLines + 1
    for (let end = start + 1; end <= maxEnd; end += 1) {
      const line = createLine(context, graphemes, start, end, lineIndex, lineCount, lineHeight)
      if (!line || line.width > maxWidth) break
      visit(end, lineIndex + 1, [...lines, line])
    }
  }

  visit(0, 0, [])
  return best
}

function createLine(
  context: OffscreenCanvasRenderingContext2D,
  graphemes: string[],
  start: number,
  end: number,
  lineIndex: number,
  lineCount: number,
  lineHeight: number,
): AvatarLine | null {
  const text = graphemes.slice(start, end).join('')
  if (text.length === 0) return null

  return {
    text,
    y: lineY(lineIndex, lineCount, lineHeight),
    width: measureText(context, text),
  }
}

function preferredLineCount(length: number, maxLines: number): number {
  return Math.min(maxLines, Math.max(2, Math.ceil(length / 3)))
}

function layoutScore(lines: AvatarLine[], radius: number, lineHeight: number): number {
  const fills = lines.map((line) => line.width / lineLimit(radius, line.y, lineHeight))
  const average = fills.reduce((sum, fill) => sum + fill, 0) / fills.length
  const ragged = fills.reduce((sum, fill) => sum + (fill - average) ** 2, 0)
  const lastShort = Math.max(0, average - fills[fills.length - 1])
  return ragged + lastShort * 0.8
}

function lineY(index: number, count: number, lineHeight: number): number {
  return (index - (count - 1) / 2) * lineHeight
}

function chordWidth(radius: number, y: number): number {
  const half = Math.sqrt(Math.max(0, radius * radius - y * y))
  return half * 2
}

function lineLimit(radius: number, y: number, lineHeight: number): number {
  const textRadius = radius * TEXT_RADIUS_RATIO
  const halfLine = lineHeight / 2
  return Math.min(
    chordWidth(textRadius, y - halfLine),
    chordWidth(textRadius, y + halfLine),
  )
}

function measureText(
  context: OffscreenCanvasRenderingContext2D,
  text: string,
): number {
  return context.measureText(text).width
}

function fontSpec(fontSize: number): string {
  return `500 ${fontSize}px ${FONT_FAMILY}`
}

function hasAvatarText(text: string): boolean {
  return text.replace(/\r\n|\r|\n/g, '').length > 0
}

function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n|\r|\n/g, ' ')
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), (segment) => segment.segment)
  }
  return Array.from(text)
}
