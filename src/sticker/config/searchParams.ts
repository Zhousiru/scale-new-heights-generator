import {
  DEFAULT_STICKER_CONTROLS,
  normalizeStickerControls,
  STICKER_DEFAULT_OUTLINE_WIDTH,
  type StickerControls,
} from './defaults'

// 控件的扁平短键 query 表示。只输出与默认值不同的项，让可分享的 URL 保持紧凑。
export type StickerSearch = Record<string, string>

export function controlsToSearch(controls: StickerControls): StickerSearch {
  const d = DEFAULT_STICKER_CONTROLS
  const search: StickerSearch = {}

  const put = (key: string, val: string | number, def: string | number) => {
    if (val !== def) search[key] = String(val)
  }
  const putColor = (key: string, val: string, def: string) => {
    if (val !== def) search[key] = val.replace('#', '')
  }
  // 渐变颜色数组：连字符拼接去掉 # 的 hex（如 `abcdef-112233`）。
  const putColors = (key: string, val: string[], def: string[]) => {
    const encode = (list: string[]) =>
      list.map((c) => c.replace('#', '')).join('-')
    const encoded = encode(val)
    if (encoded !== encode(def)) search[key] = encoded
  }

  put('t', controls.text, d.text)
  put('fl', controls.flavor, d.flavor)
  put('ic', controls.icon, d.icon)
  put('fs', controls.fontSize, d.fontSize)
  put('ls', controls.letterSpacing, d.letterSpacing)
  put('lh', controls.lineHeight, d.lineHeight)
  put('ao', controls.alternatingOffset, d.alternatingOffset)
  put('pk', controls.peak ? 1 : 0, d.peak ? 1 : 0)
  put('tl', controls.tilt ? 1 : 0, d.tilt ? 1 : 0)
  put('it', controls.iconTilt ? 1 : 0, d.iconTilt ? 1 : 0)
  put('aa', controls.antialiasScale, d.antialiasScale)
  if (controls.flash && controls.flashStops > 0) search.fx = formatNumber(controls.flashStops)

  put('sx', controls.shadow.offsetX, d.shadow.offsetX)
  put('sy', controls.shadow.offsetY, d.shadow.offsetY)
  put('sb', controls.shadow.blur, d.shadow.blur)
  putColor('sc', controls.shadow.color, d.shadow.color)
  put('so', controls.shadow.opacity, d.shadow.opacity)

  put(
    'os',
    controls.envelope.outlineStrokeWidth,
    STICKER_DEFAULT_OUTLINE_WIDTH[controls.flavor],
  )
  put('ew', controls.envelope.edgeWidth, d.envelope.edgeWidth)
  putColors('gc', controls.envelope.colors, d.envelope.colors)
  put('ga', controls.envelope.gradientAngle, d.envelope.gradientAngle)
  put('eo', controls.envelope.edgeOpacity, d.envelope.edgeOpacity)

  put('px', controls.padding.x, d.padding.x)
  put('py', controls.padding.y, d.padding.y)

  return search
}

export function searchToControls(search: StickerSearch): StickerControls {
  const get = (key: string): string | undefined => {
    const value = search[key]
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  const flashStops = num(get('fx'))

  return normalizeStickerControls({
    text: get('t'),
    flavor: get('fl'),
    icon: get('ic'),
    fontSize: num(get('fs')),
    letterSpacing: num(get('ls')),
    lineHeight: num(get('lh')),
    alternatingOffset: num(get('ao')),
    peak: bool(get('pk')),
    tilt: bool(get('tl')),
    iconTilt: bool(get('it')),
    antialiasScale: num(get('aa')),
    flash: flashStops !== undefined && flashStops > 0,
    flashStops,
    shadow: {
      offsetX: num(get('sx')),
      offsetY: num(get('sy')),
      blur: num(get('sb')),
      color: hex(get('sc')),
      opacity: num(get('so')),
    },
    envelope: {
      outlineStrokeWidth: num(get('os')),
      edgeWidth: num(get('ew')),
      colors: colorList(get('gc')),
      gradientAngle: num(get('ga')),
      edgeOpacity: num(get('eo')),
    },
    padding: {
      x: num(get('px')),
      y: num(get('py')),
    },
  })
}

// 只保留字符串类型的 search 条目；用作路由的 validateSearch。
export function validateStickerSearch(
  search: Record<string, unknown>,
): StickerSearch {
  const result: StickerSearch = {}
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') result[key] = value
    else if (typeof value === 'number') result[key] = String(value)
  }
  return result
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function hex(v: string | undefined): string | undefined {
  if (v === undefined) return undefined
  return `#${v}`
}

// 解析连字符拼接的渐变颜色 hex 列表；空则返回 undefined 让 normalize 回退默认。
function colorList(v: string | undefined): string[] | undefined {
  if (v === undefined) return undefined
  const colors = v
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `#${part}`)
  return colors.length > 0 ? colors : undefined
}

function bool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined
  return v === '1' || v === 'true'
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)))
}
