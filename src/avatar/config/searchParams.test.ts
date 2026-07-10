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
      fx: '1',
      aa: '2',
    })

    expect(controls).toMatchObject({
      text: '前端群',
      style: 'sunset',
      mode: 'outline',
      size: 768,
      rotation: -8,
      gradientAngle: 45,
      flash: true,
      flashStops: 1,
      antialiasScale: 2,
    })
    expect(controlsToSearch(controls)).toEqual({
      t: '前端群',
      st: 'sunset',
      md: 'outline',
      s: '768',
      r: '-8',
      ga: '45',
      fx: '1',
      aa: '2',
    })
  })
})
