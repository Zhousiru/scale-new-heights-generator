import {
  DEFAULT_AVATAR_CONTROLS,
  normalizeAvatarControls,
  type AvatarControls,
} from './defaults'

export type AvatarSearch = Record<string, string>

/** 头像 URL query 支持的短键集合 */
const AVATAR_SEARCH_KEYS = new Set(['t', 'st', 'md', 's', 'r', 'ga', 'fz', 'fw', 'lh', 'fx'])

export function controlsToSearch(controls: AvatarControls): AvatarSearch {
  const d = DEFAULT_AVATAR_CONTROLS
  const search: AvatarSearch = {}
  const put = (key: string, value: string | number, fallback: string | number) => {
    if (value !== fallback) search[key] = String(value)
  }

  put('t', controls.text, d.text)
  put('st', controls.style, d.style)
  put('md', controls.mode, d.mode)
  put('s', controls.size, d.size)
  put('r', controls.rotation, d.rotation)
  put('ga', controls.gradientAngle, d.gradientAngle)
  put('fz', controls.fontScale, d.fontScale)
  put('fw', controls.fontWeight, d.fontWeight)
  put('lh', controls.lineHeight, d.lineHeight)
  if (controls.flash && controls.flashStops > 0) search.fx = formatNumber(controls.flashStops)
  return search
}

export function searchToControls(search: AvatarSearch): AvatarControls {
  const get = (key: string): string | undefined => {
    const value = search[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  const fx = get('fx')
  const flashStops = num(fx)

  return normalizeAvatarControls({
    text: get('t'),
    style: get('st'),
    mode: get('md'),
    size: num(get('s')),
    rotation: num(get('r')),
    gradientAngle: num(get('ga')),
    fontScale: num(get('fz')),
    fontWeight: num(get('fw')),
    lineHeight: num(get('lh')),
    flash: flashStops !== undefined && flashStops > 0,
    flashStops,
  })
}

export function validateAvatarSearch(search: Record<string, unknown>): AvatarSearch {
  const result: AvatarSearch = {}
  for (const [key, value] of Object.entries(search)) {
    if (!AVATAR_SEARCH_KEYS.has(key)) continue
    if (typeof value === 'string') result[key] = value
    else if (typeof value === 'number') result[key] = String(value)
  }
  return result
}

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)))
}
