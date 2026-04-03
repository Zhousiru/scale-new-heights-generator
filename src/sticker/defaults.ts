export interface StickerShadowControls {
  offsetX: number
  offsetY: number
  blur: number
  color: string
  opacity: number
}

export interface StickerEnvelopeControls {
  spread: number
  outlineStrokeWidth: number
  edgeWidth: number
  gradientStart: string
  gradientEnd: string
  gradientAngle: number
  edgeOpacity: number
}

export interface StickerControls {
  text: string
  fontSize: number
  glyphSkewDeg: number
  letterSpacing: number
  alternatingOffset: number
  shadow: StickerShadowControls
  envelope: StickerEnvelopeControls
}

export const DEFAULT_STICKER_CONTROLS: StickerControls = {
  text: '高峰不常有',
  fontSize: 220,
  glyphSkewDeg: -3.5,
  letterSpacing: -8,
  alternatingOffset: 16,
  shadow: {
    offsetX: 5,
    offsetY: 5,
    blur: 5,
    color: '#000000',
    opacity: 0.35,
  },
  envelope: {
    spread: 16,
    outlineStrokeWidth: 20,
    edgeWidth: 4,
    gradientStart: '#0582ff',
    gradientEnd: '#dfe7f1',
    gradientAngle: 90,
    edgeOpacity: 0.2,
  },
}

export function normalizeStickerControls(value: unknown): StickerControls {
  const input = isRecord(value) ? value : {}
  const shadow = isRecord(input.shadow) ? input.shadow : {}
  const envelope = isRecord(input.envelope) ? input.envelope : {}

  return {
    text:
      typeof input.text === 'string'
        ? input.text
        : DEFAULT_STICKER_CONTROLS.text,
    fontSize: clampNumber(input.fontSize, 120, 320, DEFAULT_STICKER_CONTROLS.fontSize),
    glyphSkewDeg: clampNumber(
      input.glyphSkewDeg,
      -8,
      8,
      DEFAULT_STICKER_CONTROLS.glyphSkewDeg,
    ),
    letterSpacing: clampNumber(
      input.letterSpacing,
      -40,
      40,
      DEFAULT_STICKER_CONTROLS.letterSpacing,
    ),
    alternatingOffset: clampNumber(
      input.alternatingOffset,
      0,
      48,
      DEFAULT_STICKER_CONTROLS.alternatingOffset,
    ),
    shadow: {
      offsetX: clampNumber(
        shadow.offsetX,
        -60,
        60,
        DEFAULT_STICKER_CONTROLS.shadow.offsetX,
      ),
      offsetY: clampNumber(
        shadow.offsetY,
        -60,
        60,
        DEFAULT_STICKER_CONTROLS.shadow.offsetY,
      ),
      blur: clampNumber(shadow.blur, 0, 36, DEFAULT_STICKER_CONTROLS.shadow.blur),
      color: normalizeColor(shadow.color, DEFAULT_STICKER_CONTROLS.shadow.color),
      opacity: clampNumber(
        shadow.opacity,
        0,
        1,
        DEFAULT_STICKER_CONTROLS.shadow.opacity,
      ),
    },
    envelope: {
      spread: clampNumber(
        envelope.spread,
        8,
        72,
        DEFAULT_STICKER_CONTROLS.envelope.spread,
      ),
      outlineStrokeWidth: clampNumber(
        envelope.outlineStrokeWidth,
        0,
        32,
        DEFAULT_STICKER_CONTROLS.envelope.outlineStrokeWidth,
      ),
      edgeWidth: clampNumber(
        envelope.edgeWidth,
        0,
        12,
        DEFAULT_STICKER_CONTROLS.envelope.edgeWidth,
      ),
      gradientStart: normalizeColor(
        envelope.gradientStart,
        DEFAULT_STICKER_CONTROLS.envelope.gradientStart,
      ),
      gradientEnd: normalizeColor(
        envelope.gradientEnd,
        DEFAULT_STICKER_CONTROLS.envelope.gradientEnd,
      ),
      gradientAngle: clampNumber(
        envelope.gradientAngle,
        0,
        360,
        DEFAULT_STICKER_CONTROLS.envelope.gradientAngle,
      ),
      edgeOpacity: clampNumber(
        envelope.edgeOpacity,
        0,
        0.4,
        DEFAULT_STICKER_CONTROLS.envelope.edgeOpacity,
      ),
    },
  }
}

export function serializeStickerControls(controls: StickerControls): string {
  return JSON.stringify(controls, null, 2)
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
