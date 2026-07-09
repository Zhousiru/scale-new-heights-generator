import { describe, expect, it } from 'vitest'
import { colord } from 'colord'
import {
  colorInputValue,
  darken,
  deriveDepthColor,
  lighten,
  randomGradientPair,
  randomVividColors,
  resolveGradientStops,
} from './color'

describe('deriveDepthColor', () => {
  it('keeps hue while producing a darker companion', () => {
    const base = '#4c9acc'
    const depth = deriveDepthColor(base)
    const a = colord(base).toHsl()
    const b = colord(depth).toHsl()

    expect(Math.abs(a.h - b.h)).toBeLessThan(2)
    expect(b.l).toBeLessThan(a.l)
  })

  it('keeps light colors from becoming too deep or gray', () => {
    const base = '#66ffcc'
    const depth = deriveDepthColor(base)
    const a = colord(base).toHsl()
    const b = colord(depth).toHsl()

    expect(b.l).toBeLessThan(a.l)
    expect(a.l - b.l).toBeLessThan(18)
    expect(b.l).toBeGreaterThan(55)
    expect(b.s).toBeGreaterThanOrEqual(60)
    expect(b.s).toBeLessThan(a.s)
  })
})

describe('resolveGradientStops', () => {
  it('expands a single color into a [dark, light] pair', () => {
    const [dark, light] = resolveGradientStops(['#4c9acc'])
    expect(light).toBe('#4c9acc')
    expect(colord(dark).toHsl().l).toBeLessThan(colord(light).toHsl().l)
  })

  it('passes two/three colors through unchanged', () => {
    expect(resolveGradientStops(['#111111', '#222222'])).toEqual([
      '#111111',
      '#222222',
    ])
    expect(resolveGradientStops(['#111111', '#222222', '#333333'])).toEqual([
      '#111111',
      '#222222',
      '#333333',
    ])
  })

  it('falls back to a default pair when empty', () => {
    expect(resolveGradientStops([]).length).toBe(2)
  })
})

describe('colorInputValue', () => {
  it('normalizes shorthand hex for native color inputs', () => {
    expect(colorInputValue('#9f6')).toBe('#99ff66')
    expect(colorInputValue('#8fd')).toBe('#88ffdd')
  })
})

describe('darken', () => {
  it('scales rgb channels toward black', () => {
    expect(darken('#ffffff', 0.5)).toBe('rgb(128, 128, 128)')
    expect(darken('#808080', 0)).toBe('rgb(128, 128, 128)')
  })
})

describe('randomVividColors', () => {
  it('is deterministic given a seeded random and returns 1 to 3 hex colors', () => {
    let seed = 0.2
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const colors = randomVividColors('#1d8df0', random)
    expect(colors.length).toBeGreaterThanOrEqual(1)
    expect(colors.length).toBeLessThanOrEqual(3)
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('usually returns one color, sometimes two, and rarely three', () => {
    expect(randomVividColors('#76baf4', () => 0.4)).toHaveLength(1)
    expect(randomVividColors('#76baf4', () => 0.7)).toHaveLength(2)
    expect(randomVividColors('#76baf4', () => 0.95)).toHaveLength(3)
  })
})

describe('lighten', () => {
  it('scales rgb channels toward white', () => {
    expect(lighten('#000000', 0.5)).toBe('rgb(128, 128, 128)')
    expect(lighten('#808080', 0)).toBe('rgb(128, 128, 128)')
  })
})

describe('randomGradientPair', () => {
  it('returns two same-family base stops for the byte-style flavor', () => {
    let seed = 0.42
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const colors = randomGradientPair('#1d8df0', random)

    expect(colors).toHaveLength(2)
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
    // 字节范渲染时从基准色派生深轮廓，文字只轻微提亮。
    for (const color of colors) {
      const base = colord(color).toHsl().l
      const outline = colord(darken(color, 0.24)).toHsl().l
      const foreground = colord(lighten(color, 0.12)).toHsl().l
      expect(outline).toBeLessThan(base)
      expect(base - outline).toBeGreaterThan(12)
      expect(foreground).toBeGreaterThan(base)
      expect(foreground - base).toBeLessThan(8)
    }
  })
})
