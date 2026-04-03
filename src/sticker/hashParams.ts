import {
  DEFAULT_STICKER_CONTROLS,
  normalizeStickerControls,
  type StickerControls,
} from './defaults'

export function controlsToHash(controls: StickerControls): string {
  const d = DEFAULT_STICKER_CONTROLS
  const p = new URLSearchParams()

  const put = (key: string, val: string | number, def: string | number) => {
    if (val !== def) p.set(key, String(val))
  }
  const putColor = (key: string, val: string, def: string) => {
    if (val !== def) p.set(key, val.replace('#', ''))
  }

  put('t', controls.text, d.text)
  put('fs', controls.fontSize, d.fontSize)
  put('sk', controls.glyphSkewDeg, d.glyphSkewDeg)
  put('ls', controls.letterSpacing, d.letterSpacing)
  put('ao', controls.alternatingOffset, d.alternatingOffset)

  put('sx', controls.shadow.offsetX, d.shadow.offsetX)
  put('sy', controls.shadow.offsetY, d.shadow.offsetY)
  put('sb', controls.shadow.blur, d.shadow.blur)
  putColor('sc', controls.shadow.color, d.shadow.color)
  put('so', controls.shadow.opacity, d.shadow.opacity)

  put('es', controls.envelope.spread, d.envelope.spread)
  put('os', controls.envelope.outlineStrokeWidth, d.envelope.outlineStrokeWidth)
  put('ew', controls.envelope.edgeWidth, d.envelope.edgeWidth)
  putColor('gs', controls.envelope.gradientStart, d.envelope.gradientStart)
  putColor('ge', controls.envelope.gradientEnd, d.envelope.gradientEnd)
  put('ga', controls.envelope.gradientAngle, d.envelope.gradientAngle)
  put('eo', controls.envelope.edgeOpacity, d.envelope.edgeOpacity)

  return p.toString()
}

export function hashToControls(hash: string): StickerControls {
  const p = new URLSearchParams(hash.replace(/^#/, ''))

  return normalizeStickerControls({
    text: p.get('t') ?? undefined,
    fontSize: num(p.get('fs')),
    glyphSkewDeg: num(p.get('sk')),
    letterSpacing: num(p.get('ls')),
    alternatingOffset: num(p.get('ao')),
    shadow: {
      offsetX: num(p.get('sx')),
      offsetY: num(p.get('sy')),
      blur: num(p.get('sb')),
      color: hex(p.get('sc')),
      opacity: num(p.get('so')),
    },
    envelope: {
      spread: num(p.get('es')),
      outlineStrokeWidth: num(p.get('os')),
      edgeWidth: num(p.get('ew')),
      gradientStart: hex(p.get('gs')),
      gradientEnd: hex(p.get('ge')),
      gradientAngle: num(p.get('ga')),
      edgeOpacity: num(p.get('eo')),
    },
  })
}

export function isDownloadMode(hash: string): boolean {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  return p.get('dl') === '1'
}

export function buildDownloadHash(controls: StickerControls): string {
  const hash = controlsToHash(controls)
  return hash ? `#${hash}&dl=1` : '#dl=1'
}

function num(v: string | null): number | undefined {
  if (v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function hex(v: string | null): string | undefined {
  if (v === null) return undefined
  return `#${v}`
}
