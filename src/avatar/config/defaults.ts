import {
  DEFAULT_FLASH_STOPS,
  FLASH_STOPS_MAX,
  FLASH_STOPS_MIN,
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
  fontScale: number
  fontWeight: number
  lineHeight: number
  flash: boolean
  flashStops: number
}

export type AvatarMode = 'fill' | 'outline'

/** 头像输出尺寸最小值 */
export const AVATAR_SIZE_MIN = 128
/** 头像输出尺寸最大值 */
export const AVATAR_SIZE_MAX = 1024
/** 头像字号缩放最小值 */
export const AVATAR_FONT_SCALE_MIN = 0.85
/** 头像字号缩放最大值 */
export const AVATAR_FONT_SCALE_MAX = 1.25
/** 头像字重最小值 */
export const AVATAR_FONT_WEIGHT_MIN = 100
/** 头像字重最大值 */
export const AVATAR_FONT_WEIGHT_MAX = 800
/** 头像字重滑杆步进 */
export const AVATAR_FONT_WEIGHT_STEP = 50
/** 头像行高最小值 */
export const AVATAR_LINE_HEIGHT_MIN = 1
/** 头像行高最大值 */
export const AVATAR_LINE_HEIGHT_MAX = 1.4

/** 头像工具默认控件状态 */
export const DEFAULT_AVATAR_CONTROLS: AvatarControls = {
  text: '离职',
  style: 'aurora',
  mode: 'fill',
  size: 512,
  rotation: 0,
  gradientAngle: 135,
  fontScale: 1,
  fontWeight: 600,
  lineHeight: 1.1,
  flash: false,
  flashStops: DEFAULT_FLASH_STOPS,
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
    fontScale: clampNumber(
      input.fontScale,
      AVATAR_FONT_SCALE_MIN,
      AVATAR_FONT_SCALE_MAX,
      DEFAULT_AVATAR_CONTROLS.fontScale,
    ),
    fontWeight: clampNumber(
      input.fontWeight,
      AVATAR_FONT_WEIGHT_MIN,
      AVATAR_FONT_WEIGHT_MAX,
      DEFAULT_AVATAR_CONTROLS.fontWeight,
    ),
    lineHeight: clampNumber(
      input.lineHeight,
      AVATAR_LINE_HEIGHT_MIN,
      AVATAR_LINE_HEIGHT_MAX,
      DEFAULT_AVATAR_CONTROLS.lineHeight,
    ),
    flash:
      typeof input.flash === 'boolean'
        ? input.flash
        : DEFAULT_AVATAR_CONTROLS.flash,
    flashStops: clampNumber(
      input.flashStops,
      FLASH_STOPS_MIN,
      FLASH_STOPS_MAX,
      DEFAULT_AVATAR_CONTROLS.flashStops,
    ),
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
