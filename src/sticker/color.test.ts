import { describe, expect, it } from 'vitest'
import { colord } from 'colord'
import {
  darken,
  deriveDepthColor,
  randomVividColor,
  resolveGradientStops,
} from './color'

describe('deriveDepthColor', () => {
  it('keeps hue but produces a darker, saturated companion', () => {
    const base = '#4c9acc'
    const depth = deriveDepthColor(base)
    const a = colord(base).toHsl()
    const b = colord(depth).toHsl()

    expect(Math.abs(a.h - b.h)).toBeLessThan(2)
    expect(b.l).toBeLessThan(a.l)
    expect(b.s).toBeGreaterThanOrEqual(a.s)
  })
})

describe('resolveGradientStops', () => {
  it('expands a single color into a [light, dark] pair', () => {
    const [light, dark] = resolveGradientStops(['#4c9acc'])
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

describe('darken', () => {
  it('scales rgb channels toward black', () => {
    expect(darken('#ffffff', 0.5)).toBe('rgb(128, 128, 128)')
    expect(darken('#808080', 0)).toBe('rgb(128, 128, 128)')
  })
})

describe('randomVividColor', () => {
  it('is deterministic given a seeded random and returns a hex color', () => {
    let seed = 0.2
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const color = randomVividColor('#1d8df0', random)
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('same-hue branch preserves the base hue', () => {
    // random() 始终 >= 0.5 -> 非邻色相 -> 色相不变
    const color = randomVividColor('#1d8df0', () => 0.9)
    const base = colord('#1d8df0').toHsl()
    expect(Math.abs(colord(color).toHsl().h - base.h)).toBeLessThan(2)
  })
})
