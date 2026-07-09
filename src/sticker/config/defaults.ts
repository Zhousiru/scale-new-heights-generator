export interface StickerShadowControls {
  offsetX: number
  offsetY: number
  blur: number
  color: string
  opacity: number
}

export interface StickerEnvelopeControls {
  outlineStrokeWidth: number
  edgeWidth: number
  /** 渐变颜色停靠点，长度 1~3。单色时渲染层会自动补出同色系深色。 */
  colors: string[]
  gradientAngle: number
  edgeOpacity: number
}

export interface StickerPaddingControls {
  x: number
  y: number
}

// 渲染风味标识（命名对应参考表情包）。每种风味同时决定展示字面与配色/描边模型：
//   • snh (勇攀高峰)：白色字形置于彩色渐变包体内——抖音美好体字面。
//   • bs  (字节范)：彩色渐变字形带同色系深色轮廓——优设标题黑字面。
export type StickerFlavor = 'snh' | 'bs'

export const STICKER_FLAVORS: StickerFlavor[] = ['snh', 'bs']

export interface StickerControls {
  text: string
  /** 使用哪种渲染风味（字面 + 配色/描边模型）。 */
  flavor: StickerFlavor
  /** Iconify 图标 id（如 `mdi:rocket`），作为前缀字形渲染；留空则禁用。 */
  icon: string
  fontSize: number
  letterSpacing: number
  /** 换行行间距相对 fontSize 的倍率。 */
  lineHeight: number
  alternatingOffset: number
  /** 高峰模式：开启时词以错位高度攀登，关闭时对齐平铺。 */
  peak: boolean
  /** 文本倾斜：开启时应用字面固有的旋转/斜切；关闭时字形直立（仅保留缩放）。 */
  tilt: boolean
  /** 图标倾斜：开启时前缀图标跟随字面旋转/斜切。 */
  iconTilt: boolean
  /** 内部超采样倍率，用于平滑斜线和斜切边缘。 */
  antialiasScale: number
  shadow: StickerShadowControls
  envelope: StickerEnvelopeControls
  /** 裁剪结果四周的透明留白，按轴独立设置。 */
  padding: StickerPaddingControls
}

export const DEFAULT_STICKER_CONTROLS: StickerControls = {
  text: '高峰不常有',
  flavor: 'snh',
  icon: '',
  fontSize: 220,
  letterSpacing: -8,
  lineHeight: 1.1,
  alternatingOffset: 16,
  peak: true,
  tilt: true,
  iconTilt: true,
  antialiasScale: 1.5,
  shadow: {
    offsetX: 4,
    offsetY: 6,
    blur: 6,
    color: '#1c3e63',
    // snh 把它当作白字下方的内 multiply 阴影；
    // bs 完全忽略阴影（其立体感来自加深的轮廓）。
    opacity: 0.4,
  },
  envelope: {
    outlineStrokeWidth: 20,
    edgeWidth: 4,
    colors: ['#08e', '#9cf'],
    gradientAngle: 180,
    edgeOpacity: 0.2,
  },
  padding: {
    x: 8,
    y: 24,
  },
}

export function normalizeStickerControls(value: unknown): StickerControls {
  const input = isRecord(value) ? value : {}
  const shadow = isRecord(input.shadow) ? input.shadow : {}
  const envelope = isRecord(input.envelope) ? input.envelope : {}
  const padding = isRecord(input.padding) ? input.padding : {}

  return {
    text:
      typeof input.text === 'string'
        ? input.text
        : DEFAULT_STICKER_CONTROLS.text,
    flavor:
      input.flavor === 'bs' || input.flavor === 'snh'
        ? input.flavor
        : DEFAULT_STICKER_CONTROLS.flavor,
    icon:
      typeof input.icon === 'string'
        ? input.icon
        : DEFAULT_STICKER_CONTROLS.icon,
    fontSize: clampNumber(input.fontSize, 120, 320, DEFAULT_STICKER_CONTROLS.fontSize),
    letterSpacing: clampNumber(
      input.letterSpacing,
      -40,
      40,
      DEFAULT_STICKER_CONTROLS.letterSpacing,
    ),
    lineHeight: clampNumber(
      input.lineHeight,
      0.8,
      2,
      DEFAULT_STICKER_CONTROLS.lineHeight,
    ),
    alternatingOffset: clampNumber(
      input.alternatingOffset,
      0,
      48,
      DEFAULT_STICKER_CONTROLS.alternatingOffset,
    ),
    peak:
      typeof input.peak === 'boolean'
        ? input.peak
        : DEFAULT_STICKER_CONTROLS.peak,
    tilt:
      typeof input.tilt === 'boolean'
        ? input.tilt
        : DEFAULT_STICKER_CONTROLS.tilt,
    iconTilt:
      typeof input.iconTilt === 'boolean'
        ? input.iconTilt
        : DEFAULT_STICKER_CONTROLS.iconTilt,
    antialiasScale: clampNumber(
      input.antialiasScale,
      1,
      5,
      DEFAULT_STICKER_CONTROLS.antialiasScale,
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
      outlineStrokeWidth: clampNumber(
        envelope.outlineStrokeWidth,
        0,
        48,
        DEFAULT_STICKER_CONTROLS.envelope.outlineStrokeWidth,
      ),
      edgeWidth: clampNumber(
        envelope.edgeWidth,
        0,
        12,
        DEFAULT_STICKER_CONTROLS.envelope.edgeWidth,
      ),
      colors: normalizeColors(
        envelope.colors,
        DEFAULT_STICKER_CONTROLS.envelope.colors,
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
    padding: {
      x: clampNumber(padding.x, 0, 120, DEFAULT_STICKER_CONTROLS.padding.x),
      y: clampNumber(padding.y, 0, 120, DEFAULT_STICKER_CONTROLS.padding.y),
    },
  }
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

// 渐变颜色数组：保留 1~3 个非空字符串停靠点；非法时回退到默认。
function normalizeColors(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback
  const colors = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )
  if (colors.length === 0) return fallback
  return colors.slice(0, 3)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
