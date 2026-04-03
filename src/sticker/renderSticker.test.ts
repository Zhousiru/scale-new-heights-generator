import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STICKER_CONTROLS,
  normalizeStickerControls,
} from './defaults'
import {
  closeMaskRound,
  createStickerLayout,
  erodeMaskRound,
  findOpaqueBounds,
  getAlternatingOffset,
  measureSkewedGlyphBounds,
  splitGraphemes,
  subtractMask,
  thresholdAlphaMask,
  type GlyphMeasurement,
} from './renderSticker'

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

describe('createStickerLayout', () => {
  const measureGlyph = (_grapheme: string, fontSize: number) =>
    createMeasurement(fontSize, fontSize)

  it('applies alternating offsets in the expected up/down order', () => {
    const layout = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
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
      glyphSkewDeg: -3.5,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })
    const double = createStickerLayout('勇攀', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })
    const four = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
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
      glyphSkewDeg: -3.5,
      letterSpacing: 6,
      alternatingOffset: 16,
      measureGlyph,
    })
    const large = createStickerLayout('勇攀高峰', {
      fontSize: 280,
      glyphSkewDeg: -3.5,
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
      glyphSkewDeg: -3.5,
      letterSpacing: 0,
      alternatingOffset: 16,
      measureGlyph,
    })
    const loose = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
      letterSpacing: 30,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(loose.bounds.maxX - loose.bounds.minX).toBeGreaterThan(
      tight.bounds.maxX - tight.bounds.minX,
    )
  })

  it('supports negative letterSpacing without breaking glyph ordering', () => {
    const overlapped = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
      letterSpacing: -30,
      alternatingOffset: 16,
      measureGlyph,
    })
    const normal = createStickerLayout('勇攀高峰', {
      fontSize: 220,
      glyphSkewDeg: -3.5,
      letterSpacing: 9,
      alternatingOffset: 16,
      measureGlyph,
    })

    expect(overlapped.placements[1].x).toBeLessThan(normal.placements[1].x)
    expect(overlapped.bounds.maxX - overlapped.bounds.minX).toBeLessThan(
      normal.bounds.maxX - normal.bounds.minX,
    )
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
  it('bridges narrow gaps with round closing', () => {
    const alpha = new Uint8ClampedArray([
      255, 255, 0, 255, 255,
      255, 255, 0, 255, 255,
      255, 255, 0, 255, 255,
    ])
    const mask = thresholdAlphaMask(alpha, 5, 3, 10)
    const closed = closeMaskRound(mask, 1)

    expect(closed.data[2]).toBe(255)
    expect(closed.data[7]).toBe(255)
  })

  it('keeps a wider gap when the closing radius is too small', () => {
    const alpha = new Uint8ClampedArray([
      255, 255, 255, 0, 0, 0, 255, 255, 255,
    ])
    const mask = thresholdAlphaMask(alpha, 9, 1, 10)
    const closed = closeMaskRound(mask, 1)

    expect(closed.data[4]).toBe(0)
  })

  it('creates an inset ring inside the closed envelope', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0, 0, 0, 0,
      0, 255, 255, 0, 255, 255, 0,
      0, 255, 255, 0, 255, 255, 0,
      0, 255, 255, 0, 255, 255, 0,
      0, 0, 0, 0, 0, 0, 0,
    ])
    const mask = thresholdAlphaMask(alpha, 7, 5, 10)
    const closed = closeMaskRound(mask, 1)
    const ring = subtractMask(closed, erodeMaskRound(closed, 1))

    expect(ring.data[1 * 7 + 1]).toBe(255)
    expect(ring.data[0 * 7 + 0]).toBe(0)
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
      letterSpacing: -999,
      envelope: {
        edgeWidth: 99,
      },
    })

    expect(normalized.text).toBe('测试')
    expect(normalized.letterSpacing).toBe(-40)
    expect(normalized.envelope.edgeWidth).toBe(12)
    expect(normalized.fontSize).toBe(DEFAULT_STICKER_CONTROLS.fontSize)
  })
})

function countOpaque(mask: { data: Uint8ClampedArray }): number {
  return mask.data.reduce((count, value) => count + (value > 0 ? 1 : 0), 0)
}
