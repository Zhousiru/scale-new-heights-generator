import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STICKER_CONTROLS,
  normalizeStickerControls,
} from '../config/defaults'
import {
  classifyGrapheme,
  createStickerLayout,
  getAlternatingOffset,
  isEmojiGrapheme,
  measureSkewedGlyphBounds,
  splitGraphemes,
} from './layout'
import { fontSpec, usesFeatureFont } from './font'
import {
  dilateMaskRound,
  erodeMaskRound,
  fillEnclosedRegions,
  findOpaqueBounds,
  subtractMask,
  thresholdAlphaMask,
} from './mask'
import type {
  GlyphMeasurement,
} from './types'

function createMeasurement(width: number, fontSize: number): GlyphMeasurement {
  return {
    advanceWidth: width,
    left: 2,
    right: width - 2,
    ascent: fontSize * 0.78,
    descent: fontSize * 0.22,
  }
}

describe('splitGraphemes', () => {
  it('keeps Chinese text segmented by grapheme', () => {
    expect(splitGraphemes('勇攀高峰')).toEqual(['勇', '攀', '高', '峰'])
  })
})

describe('usesFeatureFont', () => {
  it('uses feature fonts only for the intended scripts', () => {
    expect(usesFeatureFont('snh', '高')).toBe(true)
    expect(usesFeatureFont('snh', 'A')).toBe(false)
    expect(usesFeatureFont('bs', '高')).toBe(true)
    expect(usesFeatureFont('bs', 'A')).toBe(true)
    expect(usesFeatureFont('bs', '1')).toBe(false)
    expect(usesFeatureFont('bs', '🙂')).toBe(false)
  })
})

describe('fontSpec', () => {
  it('requests bold weight for feature and fallback glyphs', () => {
    expect(fontSpec('snh', 64, '高')).toContain('normal bold 64px "DouyinSansBold"')
    expect(fontSpec('snh', 64, 'A')).toContain('normal bold 64px "PingFang SC"')
    expect(fontSpec('bs', 64, 'A')).toContain('normal bold 64px "YouSheBiaoTiHei"')
    expect(fontSpec('bs', 64, '1')).toContain('normal bold 64px "PingFang SC"')
  })
})

describe('createStickerLayout', () => {
  const measureGlyph = (_grapheme: string, fontSize: number) =>
    createMeasurement(fontSize, fontSize)

  it('applies alternating offsets in the expected up/down order', () => {
    const layout = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(layout.placements.map((placement) => placement.baselineY)).toEqual([
      -16,
      16,
      -16,
      16,
    ])
  })

  it('keeps single, double, and four glyph bounds stable', () => {
    const single = createStickerLayout('勇', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })
    const double = createStickerLayout('勇攀', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })
    const four = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(single.bounds.maxX - single.bounds.minX).toBeGreaterThan(100)
    expect(double.bounds.maxX - double.bounds.minX).toBeGreaterThan(
      single.bounds.maxX - single.bounds.minX,
    )
    expect(four.bounds.maxX - four.bounds.minX).toBeGreaterThan(
      double.bounds.maxX - double.bounds.minX,
    )
  })

  it('changes layout width when fontSize changes', () => {
    const small = createStickerLayout('勇攀高峰', {
      fontSize: 140,
      letterSpacing: 6,
      alternatingOffset: 16,
      measureGlyph,
    })
    const large = createStickerLayout('勇攀高峰', {
      fontSize: 280,
      letterSpacing: 12,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(large.bounds.maxX - large.bounds.minX).toBeGreaterThan(
      small.bounds.maxX - small.bounds.minX,
    )
  })

  it('changes layout width when letterSpacing changes', () => {
    const tight = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: 0,
      alternatingOffset: 16,
      measureGlyph,
    })
    const loose = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: 30,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(loose.bounds.maxX - loose.bounds.minX).toBeGreaterThan(
      tight.bounds.maxX - tight.bounds.minX,
    )
  })

  it('keeps every letter of an English word at the same height', () => {
    const layout = createStickerLayout('climb', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    const baselines = layout.placements.map((placement) => placement.baselineY)
    expect(baselines).toEqual([-16, -16, -16, -16, -16])
  })

  it('skews an English word as one continuous slope, not per letter', () => {
    // 施加垂直斜切后，同一单词内字母的锚点应沿倾斜基线单调下滑（整词一致倾斜），
    // 而非每个字母各自以自身锚点归零、显得参差。
    const layout = createStickerLayout('climb', {
      fontSize: 220,
      glyphTransform: { scale: [1, 1], rotationDeg: 0, skewDeg: [0, -8] },
      letterSpacing: 9,
      alternatingOffset: 0,
      measureGlyph,
    })

    const baselines = layout.placements.map((p) => p.baselineY)
    // 首字母锚点在攀登基线上（0），其余逐字母沿斜率累积偏移。
    expect(baselines[0]).toBeCloseTo(0, 5)
    for (let i = 1; i < baselines.length; i += 1) {
      expect(baselines[i]).toBeLessThan(baselines[i - 1])
    }

    // 相邻字母的锚点落差恒定 = tan(斜切) * 步进（advance + letterSpacing），
    // 说明整词是一条直线倾斜，而非逐字母重置。
    const step = 220 + 9
    const expectedDrop = Math.tan((-8 * Math.PI) / 180) * step
    for (let i = 1; i < baselines.length; i += 1) {
      expect(baselines[i] - baselines[i - 1]).toBeCloseTo(expectedDrop, 5)
    }
  })

  it('alternates the height per word for multi-word English text', () => {
    const layout = createStickerLayout('scale new heights', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    const word = layout.placements.map((p) => p.grapheme).join('')
    expect(word).toBe('scalenewheights')

    // "scale" -> 单元 0 (-16)，"new" -> 单元 1 (16)，"heights" -> 单元 2 (-16)
    const scale = layout.placements.slice(0, 5).map((p) => p.baselineY)
    const neu = layout.placements.slice(5, 8).map((p) => p.baselineY)
    const heights = layout.placements.slice(8).map((p) => p.baselineY)
    expect(new Set(scale)).toEqual(new Set([-16]))
    expect(new Set(neu)).toEqual(new Set([16]))
    expect(new Set(heights)).toEqual(new Set([-16]))
  })

  it('produces no height difference when alternatingOffset is zero (flat mode)', () => {
    const layout = createStickerLayout('scale new heights', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 0,
      measureGlyph,
    })

    expect(layout.placements.every((p) => p.baselineY === 0)).toBe(true)
  })

  it('keeps CJK characters climbing one per character even next to English', () => {
    const layout = createStickerLayout('高峰 up', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    // 高 -> -16，峰 -> 16，随后 "up" 作为一个词 -> 两个字母都是 -16
    expect(layout.placements.map((p) => p.baselineY)).toEqual([-16, 16, -16, -16])
  })

  it('supports negative letterSpacing without breaking glyph ordering', () => {
    const overlapped = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: -30,
      alternatingOffset: 16,
      measureGlyph,
    })
    const normal = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(overlapped.placements[1].x).toBeLessThan(normal.placements[1].x)
    expect(overlapped.bounds.maxX - overlapped.bounds.minX).toBeLessThan(
      normal.bounds.maxX - normal.bounds.minX,
    )
  })

  it('stacks lines split by \\n and grows total height', () => {
    const single = createStickerLayout('勇攀高峰', {
      fontSize: 200,
      letterSpacing: 0,
      alternatingOffset: 0,
      lineHeight: 1.1,
      measureGlyph,
    })
    const wrapped = createStickerLayout('勇攀\n高峰', {
      fontSize: 200,
      letterSpacing: 0,
      alternatingOffset: 0,
      lineHeight: 1.1,
      measureGlyph,
    })

    // 字形数量相同，但换行版本更高更窄。
    expect(wrapped.placements).toHaveLength(single.placements.length)
    expect(wrapped.bounds.maxY - wrapped.bounds.minY).toBeGreaterThan(
      single.bounds.maxY - single.bounds.minY,
    )
    expect(wrapped.bounds.maxX - wrapped.bounds.minX).toBeLessThan(
      single.bounds.maxX - single.bounds.minX,
    )
  })

  it('center-aligns lines of unequal width', () => {
    const layout = createStickerLayout('高峰不常有\n高峰', {
      fontSize: 200,
      letterSpacing: 0,
      alternatingOffset: 0,
      lineHeight: 1.1,
      measureGlyph,
    })

    const longLine = layout.placements.slice(0, 5)
    const shortLine = layout.placements.slice(5)
    const longCenter =
      (Math.min(...longLine.map((p) => p.bounds.minX)) +
        Math.max(...longLine.map((p) => p.bounds.maxX))) /
      2
    const shortCenter =
      (Math.min(...shortLine.map((p) => p.bounds.minX)) +
        Math.max(...shortLine.map((p) => p.bounds.maxX))) /
      2

    expect(Math.abs(longCenter - shortCenter)).toBeLessThan(1)
  })
})

describe('isEmojiGrapheme', () => {
  it('detects pictographic emoji', () => {
    expect(isEmojiGrapheme('😄')).toBe(true)
    expect(isEmojiGrapheme('😡')).toBe(true)
    expect(isEmojiGrapheme('🚀')).toBe(true)
  })

  it('is false for text, CJK, and punctuation', () => {
    expect(isEmojiGrapheme('高')).toBe(false)
    expect(isEmojiGrapheme('a')).toBe(false)
    expect(isEmojiGrapheme('7')).toBe(false)
    expect(isEmojiGrapheme('，')).toBe(false)
  })
})

describe('emoji skew handling', () => {
  const measureGlyph = (_grapheme: string, fontSize: number) =>
    createMeasurement(fontSize, fontSize)

  it('marks emoji upright and text as skewable', () => {
    const layout = createStickerLayout('高😄', {
      fontSize: 220,
      glyphTransform: { scale: [1, 1], rotationDeg: 0, skewDeg: [0, -8] },
      letterSpacing: 9,
      alternatingOffset: 0,
      measureGlyph,
    })

    const [text, emoji] = layout.placements
    expect(text.grapheme).toBe('高')
    expect(text.skew).toBe(true)
    expect(emoji.grapheme).toBe('😄')
    expect(emoji.skew).toBe(false)
  })

  it('keeps emoji bounds unsheared while text bounds shear', () => {
    const layout = createStickerLayout('高😄', {
      fontSize: 220,
      glyphTransform: { scale: [1, 1], rotationDeg: 0, skewDeg: [0, -8] },
      letterSpacing: 9,
      alternatingOffset: 0,
      measureGlyph,
    })

    const neutral = measureSkewedGlyphBounds(createMeasurement(220, 220), 0)
    const neutralHeight = neutral.maxY - neutral.minY
    const text = layout.placements[0]
    const emoji = layout.placements[1]
    const emojiHeight = emoji.bounds.maxY - emoji.bounds.minY
    const textHeight = text.bounds.maxY - text.bounds.minY
    expect(emojiHeight).toBeCloseTo(neutralHeight, 5)
    expect(textHeight).toBeGreaterThan(neutralHeight)
  })
})

describe('classifyGrapheme', () => {
  it('separates CJK, word, space, and other graphemes', () => {
    expect(classifyGrapheme('高')).toBe('cjk')
    expect(classifyGrapheme('あ')).toBe('cjk')
    expect(classifyGrapheme('a')).toBe('word')
    expect(classifyGrapheme('7')).toBe('word')
    expect(classifyGrapheme('é')).toBe('word')
    expect(classifyGrapheme('+')).toBe('word')
    expect(classifyGrapheme(' ')).toBe('space')
    expect(classifyGrapheme('，')).toBe('other')
  })
})

describe('measureSkewedGlyphBounds', () => {
  it('changes the glyph bounds when skew changes', () => {
    const baseMeasurement = createMeasurement(220, 220)
    const neutral = measureSkewedGlyphBounds(baseMeasurement, 0)
    const skewed = measureSkewedGlyphBounds(baseMeasurement, -8)

    expect(skewed.minY).toBeLessThan(neutral.minY)
    expect(skewed.maxY).not.toBe(neutral.maxY)
  })
})

describe('mask helpers', () => {
  it('grows the mask outward by the dilation radius', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
      0, 0, 255, 0, 0,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
    ])
    const mask = thresholdAlphaMask(alpha, 5, 5, 10)
    const grown = dilateMaskRound(mask, 1)

    // 单个不透明像素的 4 邻域现在也被填充了。
    expect(grown.data[2 * 5 + 1]).toBe(255)
    expect(grown.data[2 * 5 + 3]).toBe(255)
    expect(grown.data[1 * 5 + 2]).toBe(255)
    expect(grown.data[3 * 5 + 2]).toBe(255)
    // 半径 1 时对角像素保持空白（距离 √2 > 1）。
    expect(grown.data[1 * 5 + 1]).toBe(0)
  })

  it('does not bridge a gap wider than the dilation radius', () => {
    const alpha = new Uint8ClampedArray([
      255, 255, 255, 0, 0, 0, 255, 255, 255,
    ])
    const mask = thresholdAlphaMask(alpha, 9, 1, 10)
    const grown = dilateMaskRound(mask, 1)

    expect(grown.data[4]).toBe(0)
  })

  it('creates an inset ring inside the dilated envelope', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0, 0, 0, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 0, 0, 0, 0, 0, 0,
    ])
    const mask = thresholdAlphaMask(alpha, 7, 5, 10)
    const envelope = fillEnclosedRegions(dilateMaskRound(mask, 1))
    const eroded = erodeMaskRound(envelope, 1)
    const ring = subtractMask(envelope, eroded)

    expect(countOpaque(ring)).toBeGreaterThan(0)
    expect(countOpaque(ring)).toBeLessThan(countOpaque(envelope))
    // 腐蚀严格缩小包体，因此环恰好落在其边界上。
    expect(countOpaque(eroded)).toBeLessThan(countOpaque(envelope))
  })

  it('grows the deep edge ring when edge width increases', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0, 0, 0, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 255, 255, 255, 255, 255, 0,
      0, 0, 0, 0, 0, 0, 0,
    ])
    const mask = thresholdAlphaMask(alpha, 7, 5, 10)
    const narrowRing = subtractMask(mask, erodeMaskRound(mask, 1))
    const wideRing = subtractMask(mask, erodeMaskRound(mask, 3))

    expect(countOpaque(narrowRing)).toBeLessThan(countOpaque(wideRing))
  })

  it('fills fully enclosed background regions', () => {
    const alpha = new Uint8ClampedArray([
      255, 255, 255, 255, 255,
      255, 0, 0, 0, 255,
      255, 0, 0, 0, 255,
      255, 0, 0, 0, 255,
      255, 255, 255, 255, 255,
    ])
    const mask = thresholdAlphaMask(alpha, 5, 5, 10)
    const filled = fillEnclosedRegions(mask)

    expect(filled.data[2 * 5 + 2]).toBe(255)
    expect(countOpaque(filled)).toBe(25)
  })

  it('leaves background regions open to the border untouched', () => {
    const alpha = new Uint8ClampedArray([
      255, 255, 255, 255, 255,
      255, 0, 0, 0, 255,
      255, 0, 0, 0, 0,
      255, 0, 0, 0, 255,
      255, 255, 255, 255, 255,
    ])
    const mask = thresholdAlphaMask(alpha, 5, 5, 10)
    const filled = fillEnclosedRegions(mask)

    expect(filled.data[2 * 5 + 2]).toBe(0)
  })
})

describe('findOpaqueBounds', () => {
  it('captures content, shadow, and envelope extents without clipping', () => {
    const alpha = new Uint8ClampedArray(8 * 6)
    alpha[1 * 8 + 1] = 120
    alpha[2 * 8 + 2] = 255
    alpha[4 * 8 + 6] = 80

    expect(findOpaqueBounds(alpha, 8, 6)).toEqual({
      left: 1,
      top: 1,
      right: 6,
      bottom: 4,
    })
  })

  it('returns null for an empty image', () => {
    expect(findOpaqueBounds(new Uint8ClampedArray(16), 4, 4)).toBeNull()
  })
})

describe('alternating offsets', () => {
  it('starts with upward displacement for the first glyph', () => {
    expect(getAlternatingOffset(0, 16)).toBe(-16)
    expect(getAlternatingOffset(1, 16)).toBe(16)
  })
})

describe('normalizeStickerControls', () => {
  it('merges partial JSON with defaults and clamps values', () => {
    const normalized = normalizeStickerControls({
      text: '测试',
      antialiasScale: 9,
      letterSpacing: -999,
      envelope: {
        edgeWidth: 99,
      },
    })

    expect(normalized.text).toBe('测试')
    expect(normalized.antialiasScale).toBe(5)
    expect(normalized.letterSpacing).toBe(-40)
    expect(normalized.envelope.edgeWidth).toBe(12)
    expect(normalized.fontSize).toBe(DEFAULT_STICKER_CONTROLS.fontSize)
  })

  it('accepts a known flavor and falls back for unknown values', () => {
    expect(normalizeStickerControls({ flavor: 'bs' }).flavor).toBe('bs')
    expect(normalizeStickerControls({ flavor: 'snh' }).flavor).toBe('snh')
    expect(normalizeStickerControls({ flavor: 'comic-sans' }).flavor).toBe(
      DEFAULT_STICKER_CONTROLS.flavor,
    )
    expect(normalizeStickerControls({}).flavor).toBe(DEFAULT_STICKER_CONTROLS.flavor)
  })
})

function countOpaque(mask: { data: Uint8ClampedArray }): number {
  return mask.data.reduce((count, value) => count + (value > 0 ? 1 : 0), 0)
}
