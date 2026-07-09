import type { StickerFlavor } from '../config/defaults'
import { isChineseDominant } from './font'
import {
  IDENTITY_GLYPH_TRANSFORM,
  type Bounds,
  type GlyphMeasurement,
  type GlyphPlacement,
  type GlyphTransform,
  type StickerLayout,
} from './types'

// 词与词之间空格步进占空格自身宽度的比例。取 1 让空格保持字体的自然宽度，
// 避免西文单词粘连（此前 0.35 在 Inter 下会挤没空格）。
const SPACE_ADVANCE_SCALE = 1

export function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }

  return Array.from(text)
}

export function getAlternatingOffset(index: number, amplitude: number): number {
  return index % 2 === 0 ? -amplitude : amplitude
}

export type GraphemeKind = 'space' | 'cjk' | 'word' | 'other'

const CJK_PATTERN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\uff66-\uff9f]/u
const WORD_PATTERN = /[0-9A-Za-z\u00c0-\u024f'’.+-]/u
// 图形类 Emoji（含 ZWJ 连字序列 / 变体选择符）。它们以接近正方形的彩色字形绘制，
// 若斜切成平行四边形会产生尖角，描边膨胀会把这些尖角变成杂散“尖峰”；因此保持直立。
// eslint-disable-next-line no-misleading-character-class
const EMOJI_PATTERN = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u200d\u{FE0F}\u{20E3}]/u

// 对于永远不应被斜切的字素（彩色 Emoji 字形）返回 true。
export function isEmojiGrapheme(grapheme: string): boolean {
  return EMOJI_PATTERN.test(grapheme)
}

// 对字素分类，决定它如何归入一个“攀登”单元。CJK 字符逐字攀登（行为不变），
// 而连续的拉丁字母/数字合并为一个词单元，使词内每个字母共享同一高度。
export function classifyGrapheme(grapheme: string): GraphemeKind {
  if (/^\s+$/u.test(grapheme)) return 'space'
  if (CJK_PATTERN.test(grapheme)) return 'cjk'
  if (WORD_PATTERN.test(grapheme)) return 'word'
  return 'other'
}

export function measureSkewedGlyphBounds(
  measurement: GlyphMeasurement,
  skewDeg: number,
): Bounds {
  const skewTangent = Math.tan((skewDeg * Math.PI) / 180)
  const corners = [
    { x: -measurement.left, y: -measurement.ascent },
    { x: measurement.right, y: -measurement.ascent },
    { x: -measurement.left, y: measurement.descent },
    { x: measurement.right, y: measurement.descent },
  ]

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const corner of corners) {
    const nextY = corner.y + skewTangent * corner.x
    minX = Math.min(minX, corner.x)
    minY = Math.min(minY, nextY)
    maxX = Math.max(maxX, corner.x)
    maxY = Math.max(maxY, nextY)
  }

  return { minX, minY, maxX, maxY }
}

export function createStickerLayout(
  text: string,
  options: {
    fontSize: number
    alternatingOffset: number
    letterSpacing: number
    lineHeight?: number
    flavor?: StickerFlavor
    glyphTransform?: GlyphTransform
    measureGlyph: (grapheme: string, fontSize: number) => GlyphMeasurement
  },
): StickerLayout {
  const glyphTransform = options.glyphTransform ?? IDENTITY_GLYPH_TRANSFORM
  // 垂直斜切参与字形边界测量，让居中/裁剪把倾斜后的外扩纳入考量。
  const verticalSkewDeg = glyphTransform.skewDeg[1]
  const lines = text.split('\n')
  const lineSpacing = options.fontSize * (options.lineHeight ?? 1.1)
  const laidLines = lines.map((line) =>
    layoutLine(line, { ...options, verticalSkewDeg }),
  )

  const lineWidths = laidLines.map((line) =>
    line.bounds ? line.bounds.maxX - line.bounds.minX : 0,
  )
  const maxWidth = lineWidths.reduce((max, width) => Math.max(max, width), 0)
  const commonLeft = laidLines.reduce(
    (left, line) => (line.bounds ? Math.min(left, line.bounds.minX) : left),
    Number.POSITIVE_INFINITY,
  )
  const anchorLeft = Number.isFinite(commonLeft) ? commonLeft : 0

  const placements: GlyphPlacement[] = []
  let bounds: Bounds | null = null

  laidLines.forEach((line, lineIndex) => {
    const offsetY = lineIndex * lineSpacing
    const shiftX = line.bounds
      ? anchorLeft + (maxWidth - (line.bounds.maxX - line.bounds.minX)) / 2 - line.bounds.minX
      : 0

    for (const placement of line.placements) {
      const shifted: GlyphPlacement = {
        grapheme: placement.grapheme,
        x: placement.x + shiftX,
        baselineY: placement.baselineY + offsetY,
        advanceWidth: placement.advanceWidth,
        bounds: offsetBounds(placement.bounds, shiftX, offsetY),
        skew: placement.skew,
      }
      placements.push(shifted)
      bounds = bounds ? mergeBounds(bounds, shifted.bounds) : shifted.bounds
    }
  })

  return {
    placements,
    bounds: bounds ?? emptyBounds(),
    letterSpacing: options.letterSpacing,
    fontSize: options.fontSize,
    flavor: options.flavor ?? 'snh',
    chineseDominant: isChineseDominant(text),
    glyphTransform,
  }
}

function layoutLine(
  text: string,
  options: {
    fontSize: number
    verticalSkewDeg: number
    alternatingOffset: number
    letterSpacing: number
    measureGlyph: (grapheme: string, fontSize: number) => GlyphMeasurement
  },
): { placements: GlyphPlacement[]; bounds: Bounds | null } {
  const graphemes = splitGraphemes(text)
  const letterSpacing = options.letterSpacing
  // 垂直斜切的正切：把词内字母的锚点沿倾斜基线预先下压，实现整词连续倾斜。
  const verticalSkewTangent = Math.tan((options.verticalSkewDeg * Math.PI) / 180)

  const placements: GlyphPlacement[] = []
  let cursorX = 0
  let bounds: Bounds | null = null

  // 一个“单元”是一个攀登步。每个 CJK 字符自成一个单元，而连续的拉丁词字符
  // 共享同一个单元（因而共享同一个 baselineY），使英文词内所有字母坐落同一高度。
  let unitIndex = -1
  let prevKind: GraphemeKind | null = null
  // 当前攀登单元起点的水平笔位；词内字母以此为参照计算 unitOffsetX。
  let unitStartX = 0

  graphemes.forEach((grapheme) => {
    const kind = classifyGrapheme(grapheme)

    if (kind === 'space') {
      const measurement = options.measureGlyph(grapheme, options.fontSize)
      cursorX += Math.max(0, measurement.advanceWidth * SPACE_ADVANCE_SCALE)
      prevKind = 'space'
      return
    }

    const continuesWord = kind === 'word' && prevKind === 'word'
    if (!continuesWord) {
      unitIndex += 1
      unitStartX = cursorX
    }

    const measurement = options.measureGlyph(grapheme, options.fontSize)
    const canSkew = !isEmojiGrapheme(grapheme)
    // 字母相对所属单元起点的水平偏移；CJK/Emoji 自成一个单元恒为 0。
    const unitOffsetX = cursorX - unitStartX
    const skewedBounds = measureSkewedGlyphBounds(
      measurement,
      canSkew ? options.verticalSkewDeg : 0,
    )
    // 词内字母的锚点沿倾斜基线预先下压 tan(垂直斜切)*词内偏移，叠加到攀登基线上。
    // 这样整个英文单词共享一条连续倾斜的基线，绘制时逐字形的垂直斜切便自然首尾相接，
    // 消除了原先每个字母各自以自身锚点倾斜导致的参差。
    const wordTiltY = canSkew ? verticalSkewTangent * unitOffsetX : 0
    const baselineY =
      getAlternatingOffset(unitIndex, options.alternatingOffset) + wordTiltY
    const placementBounds = offsetBounds(skewedBounds, cursorX, baselineY)

    placements.push({
      grapheme,
      x: cursorX,
      baselineY,
      advanceWidth: measurement.advanceWidth,
      bounds: placementBounds,
      skew: canSkew,
    })

    bounds = bounds ? mergeBounds(bounds, placementBounds) : placementBounds
    cursorX += measurement.advanceWidth + letterSpacing
    prevKind = kind
  })

  return { placements, bounds }
}

export function mergeBounds(left: Bounds, right: Bounds): Bounds {
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  }
}

export function offsetBounds(bounds: Bounds, offsetX: number, offsetY: number): Bounds {
  return {
    minX: bounds.minX + offsetX,
    minY: bounds.minY + offsetY,
    maxX: bounds.maxX + offsetX,
    maxY: bounds.maxY + offsetY,
  }
}

export function emptyBounds(): Bounds {
  return {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  }
}
