import { describe, expect, it } from 'vitest'
import { DEFAULT_STICKER_CONTROLS } from './defaults'
import {
  controlsToSearch,
  searchToControls,
  validateStickerSearch,
} from './searchParams'

describe('searchParams', () => {
  it('omits values equal to the defaults', () => {
    expect(controlsToSearch(DEFAULT_STICKER_CONTROLS)).toEqual({})
  })

  it('emits short keys only for changed values', () => {
    const search = controlsToSearch({
      ...DEFAULT_STICKER_CONTROLS,
      text: '测试',
      flavor: 'bs',
      antialiasScale: 5,
      envelope: { ...DEFAULT_STICKER_CONTROLS.envelope, colors: ['#abcdef'] },
    })

    expect(search).toEqual({ t: '测试', fl: 'bs', aa: '5', gc: 'abcdef' })
  })

  it('round-trips a customized control set', () => {
    const controls = {
      ...DEFAULT_STICKER_CONTROLS,
      text: '高峰\n不常有',
      flavor: 'bs' as const,
      icon: 'mdi:rocket',
      fontSize: 260,
      lineHeight: 1.4,
      antialiasScale: 5,
      peak: false,
      iconTilt: false,
      envelope: {
        ...DEFAULT_STICKER_CONTROLS.envelope,
        colors: ['#112233', '#445566', '#778899'],
        gradientAngle: 90,
      },
      padding: { x: 40, y: 60 },
    }

    const restored = searchToControls(controlsToSearch(controls))
    expect(restored).toEqual(controls)
  })

  it('falls back to defaults for missing keys', () => {
    expect(searchToControls({})).toEqual(DEFAULT_STICKER_CONTROLS)
  })

  it('coerces numbers to strings during validation', () => {
    expect(validateStickerSearch({ fs: 200, t: '嗨', bad: null })).toEqual({
      fs: '200',
      t: '嗨',
    })
  })
})
