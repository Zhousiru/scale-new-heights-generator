import type { StickerFlavor } from '../config/defaults'
import { createCanvas, getContext } from './canvas'
import {
  type GlyphMeasurement,
  type GlyphTransform,
} from './types'

const FONT_STYLE = 'normal'
const FONT_SAMPLE_TEXT = '勇攀高峰测试Aa0123456789'
const HAN_PATTERN = /\p{Script=Han}/u
const LATIN_PATTERN = /\p{Script=Latin}/u

interface FontDescriptor {
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

const FONT_REGISTRY: Record<StickerFlavor, FontDescriptor> = {
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

// 每种字体的字形整形参数（缩放 + 旋转 + 斜切）。返回 FONT_REGISTRY 中手动精调
// 的旋钮。只整形文字字形；Emoji 保持直立以避免描边尖峰。
export function fontGlyphTransform(flavor: StickerFlavor): GlyphTransform {
  return FONT_REGISTRY[flavor].transform
}

export function effectiveOutlineWidth(flavor: StickerFlavor, width: number): number {
  return width * FONT_REGISTRY[flavor].outlineScale
}

export function usesFeatureFont(flavor: StickerFlavor, grapheme?: string): boolean {
  if (!grapheme) return false
  if (flavor === 'snh') return HAN_PATTERN.test(grapheme)
  return HAN_PATTERN.test(grapheme) || LATIN_PATTERN.test(grapheme)
}

export function fontSpec(
  flavor: StickerFlavor,
  fontSize: number,
  grapheme?: string,
): string {
  const { family, weight } = FONT_REGISTRY[flavor]
  const families = [
    ...(usesFeatureFont(flavor, grapheme) ? [`"${family}"`] : []),
    '"PingFang SC"',
    '"Apple Color Emoji"',
    '"Apple Symbols"',
    '"Noto Color Emoji"',
    '"Noto Sans Symbols 2"',
    'sans-serif',
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
  if (typeof FontFace === 'undefined') return

  let promise = fontLoadPromises.get(flavor)
  if (!promise) {
    const fonts: FontFaceSet | undefined =
      typeof document !== 'undefined'
        ? document.fonts
        : (globalThis as unknown as { fonts?: FontFaceSet }).fonts

    if (!fonts) return

    const descriptor = FONT_REGISTRY[flavor]
    const spec = `${FONT_STYLE} ${descriptor.weight} 16px "${descriptor.family}"`
    const fontFace = new FontFace(
      descriptor.family,
      `url(${import.meta.env.BASE_URL}${descriptor.file})`,
      { style: FONT_STYLE, weight: descriptor.weight },
    )

    promise = fontFace
      .load()
      .then((loaded) => {
        fonts.add(loaded)
        return fonts.load(spec, FONT_SAMPLE_TEXT).then(() => undefined)
      })
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
): GlyphMeasurement {
  const canvas = measurementCanvas ?? createCanvas(1, 1)
  measurementCanvas = canvas
  const context = getContext(canvas)
  context.font = fontSpec(flavor, fontSize, grapheme)
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
