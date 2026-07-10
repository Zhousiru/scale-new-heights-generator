import { describe, expect, it } from 'vitest'
import {
  controlsToSearch,
  searchToControls,
} from './searchParams'

describe('avatar search params', () => {
  it('round-trips flat string controls', () => {
    const controls = searchToControls({
      t: '前端群',
      st: 'sunset',
      md: 'outline',
      s: '768',
      r: '-8',
      ga: '45',
      fz: '1.12',
      fw: '700',
      lh: '1.24',
      fx: '1',
    })

    expect(controls).toMatchObject({
      text: '前端群',
      style: 'sunset',
      mode: 'outline',
      size: 768,
      rotation: -8,
      gradientAngle: 45,
      fontScale: 1.12,
      fontWeight: 700,
      lineHeight: 1.24,
      flash: true,
      flashStops: 1,
    })
    expect(controlsToSearch(controls)).toEqual({
      t: '前端群',
      st: 'sunset',
      md: 'outline',
      s: '768',
      r: '-8',
      ga: '45',
      fz: '1.12',
      fw: '700',
      lh: '1.24',
      fx: '1',
    })
  })
})
