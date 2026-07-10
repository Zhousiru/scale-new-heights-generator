import {
  DEFAULT_ANTIALIAS_SCALE,
  normalizeAntialiasScale,
} from '../../shared/config/scale'
import {
  DEFAULT_FLASH_STOPS,
  FLASH_STOPS_MAX,
  FLASH_STOPS_MIN,
  FLASH_STOPS_STEP,
} from '../../shared/config/hdr'
import {
  AVATAR_STYLES,
  type AvatarStyle,
} from './styles'

export interface AvatarControls {
  text: string
  style: AvatarStyle
  mode: AvatarMode
  size: number
  rotation: number
  gradientAngle: number
  flash: boolean
  flashStops: number
  antialiasScale: number
}

export type AvatarMode = 'fill' | 'outline'

export const AVATAR_SIZE_MIN = 128
export const AVATAR_SIZE_MAX = 1024
export const AVATAR_FLASH_STOPS_MIN = FLASH_STOPS_MIN
export const AVATAR_FLASH_STOPS_MAX = FLASH_STOPS_MAX
export const AVATAR_FLASH_STOPS_STEP = FLASH_STOPS_STEP

export const DEFAULT_AVATAR_CONTROLS: AvatarControls = {
  text: '离职',
  style: 'aurora',
  mode: 'fill',
  size: 512,
  rotation: 0,
  gradientAngle: 135,
  flash: false,
  flashStops: DEFAULT_FLASH_STOPS,
  antialiasScale: DEFAULT_ANTIALIAS_SCALE,
}

export function normalizeAvatarControls(value: unknown): AvatarControls {
  const input = isRecord(value) ? value : {}
  const style =
    typeof input.style === 'string' && input.style in AVATAR_STYLES
      ? input.style as AvatarStyle
      : DEFAULT_AVATAR_CONTROLS.style

  return {
    text:
      typeof input.text === 'string'
        ? input.text
        : DEFAULT_AVATAR_CONTROLS.text,
    style,
    mode:
      input.mode === 'outline' || input.mode === 'fill'
        ? input.mode
        : DEFAULT_AVATAR_CONTROLS.mode,
    size: clampNumber(
      input.size,
      AVATAR_SIZE_MIN,
      AVATAR_SIZE_MAX,
      DEFAULT_AVATAR_CONTROLS.size,
    ),
    rotation: clampNumber(
      input.rotation,
      -180,
      180,
      DEFAULT_AVATAR_CONTROLS.rotation,
    ),
    gradientAngle: clampNumber(
      input.gradientAngle,
      0,
      360,
      AVATAR_STYLES[style].gradientAngle ?? DEFAULT_AVATAR_CONTROLS.gradientAngle,
    ),
    flash:
      typeof input.flash === 'boolean'
        ? input.flash
        : DEFAULT_AVATAR_CONTROLS.flash,
    flashStops: clampNumber(
      input.flashStops,
      AVATAR_FLASH_STOPS_MIN,
      AVATAR_FLASH_STOPS_MAX,
      DEFAULT_AVATAR_CONTROLS.flashStops,
    ),
    antialiasScale: normalizeAntialiasScale(input.antialiasScale),
  }
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
