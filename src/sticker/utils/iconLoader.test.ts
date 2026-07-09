import { describe, expect, it } from 'vitest'
import { iconIdToUrl } from './iconLoader'

describe('iconIdToUrl', () => {
  it('builds an Iconify SVG url from a prefix:name id', () => {
    expect(iconIdToUrl('mdi:rocket')).toBe(
      'https://api.iconify.design/mdi/rocket.svg?height=256',
    )
  })

  it('accepts a hyphen separator and keeps hyphenated names intact', () => {
    expect(iconIdToUrl('mdi-rocket-launch')).toBe(
      'https://api.iconify.design/mdi/rocket-launch.svg?height=256',
    )
  })

  it('appends an encoded color when one is requested', () => {
    expect(iconIdToUrl('ph:heart-duotone', '#1688ff')).toBe(
      'https://api.iconify.design/ph/heart-duotone.svg?height=256&color=%231688ff',
    )
  })

  it('returns null for blank or malformed ids', () => {
    expect(iconIdToUrl('')).toBeNull()
    expect(iconIdToUrl('   ')).toBeNull()
    expect(iconIdToUrl('rocket')).toBeNull()
    expect(iconIdToUrl(':rocket')).toBeNull()
    expect(iconIdToUrl('mdi:')).toBeNull()
  })
})
