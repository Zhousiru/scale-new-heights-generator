import type { StickerFlavor } from '../config/defaults'
import { CANVAS_FONT_FAMILIES } from '../config/fonts'
import { getContext } from './canvas'
import {
  isCommonHanGrapheme,
  isWesternWordGrapheme,
} from './characters'
import { loadFontFace } from './fontFace'
import { createRuntimeCanvas } from './runtime'
import {
  type GlyphMeasurement,
  type GlyphTransform,
} from './types'

const FONT_STYLE = 'normal'
const FONT_SAMPLE_TEXT = '勇攀高峰测试Aa0123456789'
const CHINESE_DOMINANT_MIN_RATIO = 0.2

export interface StickerFontDescriptor {
  family: string
  weight: string
  file: string
  /** 同一个 UI 描边值在不同字面上的视觉外扩倍率。 */
  outlineScale: number
  /**
   * 每种字体在绘制时应用的字形整形参数（见 `drawPlacedGlyphs`）。这些是按字面
   * 手动精调的旋钮，只作用于文字字形（Emoji 保持直立）。所有变换都以每个字形的
   * 基线锚点为中心。垂直斜切（skewDeg[1]）即字面固有的竖向倾斜。
   */
  transform: GlyphTransform
}

const FONT_REGISTRY: Record<StickerFlavor, StickerFontDescriptor> = {
  snh: {
    family: 'DouyinSansBold',
    weight: 'bold',
    file: 'DouyinSansBold.woff2',
    outlineScale: 1,
    // >>> 勇攀高峰 (抖音美好体) 手动精调区：如需垂直方向挤压等，改这里 <<<
    // scale=[水平, 垂直]；skewDeg=[水平斜切, 垂直斜切]（度）。
    // 垂直斜切 -3.5° 即该字面固有的竖向倾斜。
    transform: {
      scale: [1, 1],
      rotationDeg: 0,
      skewDeg: [0, -3.5],
    },
  },
  bs: {
    family: 'YouSheBiaoTiHei',
    weight: 'bold',
    file: 'YouSheBiaoTiHei.ttf',
    // 优设标题黑字面本身更厚，且 bs 直接画深色外轮廓；同等像素外扩会显得更重。
    outlineScale: 0.7,
    // >>> 字节范 (优设标题黑) 手动精调区：垂直拉高 + 固有水平斜切 <<<
    // scale=[水平, 垂直]；skewDeg=[水平斜切, 垂直斜切]（度）。
    transform: {
      scale: [1, 1.12],
      rotationDeg: 0,
      skewDeg: [8, -6],
    },
  },
}

export function stickerFontDescriptor(
  flavor: StickerFlavor,
): StickerFontDescriptor {
  return FONT_REGISTRY[flavor]
}

// 每种字体的字形整形参数（缩放 + 旋转 + 斜切）。返回 FONT_REGISTRY 中手动精调
// 的旋钮。只整形文字字形；Emoji 保持直立以避免描边尖峰。
export function fontGlyphTransform(flavor: StickerFlavor): GlyphTransform {
  return stickerFontDescriptor(flavor).transform
}

export function effectiveOutlineWidth(flavor: StickerFlavor, width: number): number {
  return width * stickerFontDescriptor(flavor).outlineScale
}

// 判断整段文本是否以中文为主。用于 snh：中文比例足够高时，少量英文数字随抖音
// 美好体排版更协调；中文比例低时，西文交给 Inter 以获得更现代的观感。
export function isChineseDominant(text: string): boolean {
  let han = 0
  let latin = 0
  for (const char of text) {
    if (isCommonHanGrapheme(char)) han += 1
    else if (isWesternWordGrapheme(char)) latin += 1
  }
  const textCount = han + latin
  return han > 0 && textCount > 0 && han / textCount >= CHINESE_DOMINANT_MIN_RATIO
}

export function usesFeatureFont(
  flavor: StickerFlavor,
  grapheme?: string,
  chineseDominant = false,
): boolean {
  if (!grapheme) return false
  if (isCommonHanGrapheme(grapheme)) return true
  // 优设标题黑字库含完整中英文与数字，西文与数字全部走特色字体。
  if (flavor === 'bs') {
    return isWesternWordGrapheme(grapheme)
  }
  // 抖音美好体西文字形偏窄：仅在中文占多数时用它承载英文数字，
  // 中文很少时西文落到 Inter。
  if (chineseDominant && isWesternWordGrapheme(grapheme)) {
    return true
  }
  return false
}

export function fontSpec(
  flavor: StickerFlavor,
  fontSize: number,
  grapheme?: string,
  chineseDominant = false,
): string {
  const { family, weight } = stickerFontDescriptor(flavor)
  const families = [
    ...(usesFeatureFont(flavor, grapheme, chineseDominant) ? [`"${family}"`] : []),
    ...CANVAS_FONT_FAMILIES.map((name) => `"${name}"`),
  ].join(', ')
  return `${FONT_STYLE} ${weight} ${fontSize}px ${families}`
}

const fontLoadPromises = new Map<StickerFlavor, Promise<void>>()
let measurementCanvas: OffscreenCanvas | null = null

export function iconGlyphTransformFrom(baseTransform: GlyphTransform): GlyphTransform {
  return {
    scale: [1, 1],
    rotationDeg: 0,
    skewDeg: [0, baseTransform.skewDeg[1]],
  }
}

export async function ensureStickerFontLoaded(
  flavor: StickerFlavor = 'snh',
): Promise<void> {
  let promise = fontLoadPromises.get(flavor)
  if (!promise) {
    const descriptor = FONT_REGISTRY[flavor]
    const spec = `${FONT_STYLE} ${descriptor.weight} 16px "${descriptor.family}"`

    promise = loadFontFace({
      family: descriptor.family,
      source: `url(${import.meta.env.BASE_URL}${descriptor.file})`,
      style: FONT_STYLE,
      weight: descriptor.weight,
      verify: {
        spec,
        text: FONT_SAMPLE_TEXT,
      },
    })
      .then(() => undefined)
      .catch((error: unknown) => {
        fontLoadPromises.delete(flavor)
        throw error
      })
    fontLoadPromises.set(flavor, promise)
  }

  await promise
}

export function measureGlyphWithCanvas(
  grapheme: string,
  fontSize: number,
  flavor: StickerFlavor,
  chineseDominant = false,
): GlyphMeasurement {
  const canvas = measurementCanvas ?? createRuntimeCanvas(1, 1)
  measurementCanvas = canvas
  const context = getContext(canvas)
  context.font = fontSpec(flavor, fontSize, grapheme, chineseDominant)
  context.textBaseline = 'alphabetic'

  const metrics = context.measureText(grapheme)
  const left = metrics.actualBoundingBoxLeft || 0
  const right = metrics.actualBoundingBoxRight || metrics.width
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.82
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.18

  return {
    advanceWidth: metrics.width || right + left || fontSize,
    left,
    right,
    ascent,
    descent,
  }
}
