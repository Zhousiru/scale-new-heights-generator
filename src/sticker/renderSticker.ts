import type { StickerControls, StickerFlavor } from './defaults'
import { darken, resolveGradientStops } from './color'

const FONT_STYLE = 'normal'
const FONT_SAMPLE_TEXT = '勇攀高峰测试Aa0123456789'

interface FontDescriptor {
  family: string
  weight: string
  file: string
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
    weight: '900',
    file: 'DouyinSansBold.woff2',
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
    // 优设标题黑本身就是很粗的展示字体；请求其原生字重，避免浏览器合成假粗体
    // 导致笔画粗细不均。
    family: 'YouSheBiaoTiHei',
    weight: 'normal',
    file: 'YouSheBiaoTiHei.ttf',
    // >>> 字节范 (优设标题黑) 手动精调区：垂直拉高 + 逆时针旋转 + 反向水平斜切 <<<
    // scale=[水平, 垂直]；skewDeg=[水平斜切, 垂直斜切]（度）。
    // 水平斜切 5° 约等于原 horizontalShear 效果；垂直斜切 -2.1° 是该字面固有的竖向倾斜。
    transform: {
      scale: [1, 1.12],
      rotationDeg: 2,
      skewDeg: [5, -2.1],
    },
  },
}

// 每种字体的字形整形参数（缩放 + 旋转 + 斜切）。返回 FONT_REGISTRY 中手动精调
// 的旋钮。只整形文字字形；Emoji 保持直立以避免描边尖峰。
export function fontGlyphTransform(flavor: StickerFlavor): GlyphTransform {
  return FONT_REGISTRY[flavor].transform
}

function fontSpec(flavor: StickerFlavor, fontSize: number): string {
  const { family, weight } = FONT_REGISTRY[flavor]
  return `${FONT_STYLE} ${weight} ${fontSize}px "${family}", "PingFang SC", sans-serif`
}

// 导出时文字（内容）本身归一化到的目标高度。注意这里参照的是「文字/内容」的高度
// （不含描边），而非含描边的画布总高度。这样描边加粗时，裁剪后的画布随之外扩变大、
// 文字尺寸保持稳定，导出图片（以及预览的棋盘格背景）会真实反映描边厚度的变化。
const EXPORT_TEXT_HEIGHT = 150
const MAX_EXPORT_EDGE = 2048
const ENVELOPE_ANTIALIAS = 1.1
const OUTLINE_ANTIALIAS = 0.9
const ALPHA_THRESHOLD = 16
const DISTANCE_INF = 1e15
// 词与词之间使用的空格步进占比。粗体展示字体的默认空格字形较宽，因此收紧词间距。
const SPACE_ADVANCE_SCALE = 0.35

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface GlyphMeasurement {
  advanceWidth: number
  left: number
  right: number
  ascent: number
  descent: number
}

export interface GlyphPlacement {
  grapheme: string
  x: number
  baselineY: number
  advanceWidth: number
  bounds: Bounds
  /** Emoji 字形直立绘制；文字字形继承排版倾角。 */
  skew: boolean
}

// 字形整形变换。所有变换以字形的基线锚点为中心，且仅作用于文字字形。
export interface GlyphTransform {
  /** 缩放 [水平, 垂直]。1 = 原生尺寸，>1 = 放大。优设标题黑需要一点垂直拉伸。 */
  scale: [number, number]
  /** 逆时针旋转角度（度）。正值 = 逆时针（后仰），负值 = 顺时针。 */
  rotationDeg: number
  /**
   * 斜切角度 [水平, 垂直]（度）。
   * 水平斜切：x' = x + tan(水平) * y —— 让字形顶部沿水平方向偏移。
   * 垂直斜切：y' = y + tan(垂直) * x —— 让字形右侧向下压（下坡式竖向倾斜），
   * 即字面固有的竖向倾斜。
   */
  skewDeg: [number, number]
}

const IDENTITY_GLYPH_TRANSFORM: GlyphTransform = {
  scale: [1, 1],
  rotationDeg: 0,
  skewDeg: [0, 0],
}

export interface StickerLayout {
  placements: GlyphPlacement[]
  bounds: Bounds
  letterSpacing: number
  fontSize: number
  /** 绘制时应用于文字字形的每字体整形参数。 */
  glyphTransform: GlyphTransform
}

export interface BinaryMask {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface OpaqueBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface RenderResult {
  canvas: OffscreenCanvas
  width: number
  height: number
  toBlob: () => Promise<Blob>
  toBitmap: () => ImageBitmap
}

const fontLoadPromises = new Map<StickerFlavor, Promise<void>>()
let measurementCanvas: OffscreenCanvas | null = null

export function splitGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text), ({ segment }) => segment)
  }

  return Array.from(text)
}

export function getAlternatingOffset(index: number, amplitude: number): number {
  return index % 2 === 0 ? -amplitude : amplitude
}

export type GraphemeKind = 'space' | 'cjk' | 'word' | 'other'

const CJK_PATTERN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\uff66-\uff9f]/u
const WORD_PATTERN = /[0-9A-Za-z\u00c0-\u024f'’.+-]/u
// 图形类 Emoji（含 ZWJ 连字序列 / 变体选择符）。它们以接近正方形的彩色字形绘制，
// 若斜切成平行四边形会产生尖角，描边膨胀会把这些尖角变成杂散“尖峰”；因此保持直立。
// eslint-disable-next-line no-misleading-character-class
const EMOJI_PATTERN = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|[\u200d\u{FE0F}\u{20E3}]/u

// 对于永远不应被斜切的字素（彩色 Emoji 字形）返回 true。
export function isEmojiGrapheme(grapheme: string): boolean {
  return EMOJI_PATTERN.test(grapheme)
}

// 对字素分类，决定它如何归入一个“攀登”单元。CJK 字符逐字攀登（行为不变），
// 而连续的拉丁字母/数字合并为一个词单元，使词内每个字母共享同一高度。
export function classifyGrapheme(grapheme: string): GraphemeKind {
  if (/^\s+$/u.test(grapheme)) return 'space'
  if (CJK_PATTERN.test(grapheme)) return 'cjk'
  if (WORD_PATTERN.test(grapheme)) return 'word'
  return 'other'
}

export function measureSkewedGlyphBounds(
  measurement: GlyphMeasurement,
  skewDeg: number,
): Bounds {
  const skewTangent = Math.tan((skewDeg * Math.PI) / 180)
  const corners = [
    { x: -measurement.left, y: -measurement.ascent },
    { x: measurement.right, y: -measurement.ascent },
    { x: -measurement.left, y: measurement.descent },
    { x: measurement.right, y: measurement.descent },
  ]

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const corner of corners) {
    const nextY = corner.y + skewTangent * corner.x
    minX = Math.min(minX, corner.x)
    minY = Math.min(minY, nextY)
    maxX = Math.max(maxX, corner.x)
    maxY = Math.max(maxY, nextY)
  }

  return { minX, minY, maxX, maxY }
}

export function createStickerLayout(
  text: string,
  options: {
    fontSize: number
    alternatingOffset: number
    letterSpacing: number
    lineHeight?: number
    glyphTransform?: GlyphTransform
    measureGlyph: (grapheme: string, fontSize: number) => GlyphMeasurement
  },
): StickerLayout {
  const glyphTransform = options.glyphTransform ?? IDENTITY_GLYPH_TRANSFORM
  // 垂直斜切参与字形边界测量，让居中/裁剪把倾斜后的外扩纳入考量。
  const verticalSkewDeg = glyphTransform.skewDeg[1]
  const lines = text.split('\n')
  const lineSpacing = options.fontSize * (options.lineHeight ?? 1.1)
  const laidLines = lines.map((line) =>
    layoutLine(line, { ...options, verticalSkewDeg }),
  )

  const lineWidths = laidLines.map((line) =>
    line.bounds ? line.bounds.maxX - line.bounds.minX : 0,
  )
  const maxWidth = lineWidths.reduce((max, width) => Math.max(max, width), 0)
  const commonLeft = laidLines.reduce(
    (left, line) => (line.bounds ? Math.min(left, line.bounds.minX) : left),
    Number.POSITIVE_INFINITY,
  )
  const anchorLeft = Number.isFinite(commonLeft) ? commonLeft : 0

  const placements: GlyphPlacement[] = []
  let bounds: Bounds | null = null

  laidLines.forEach((line, lineIndex) => {
    const offsetY = lineIndex * lineSpacing
    const shiftX = line.bounds
      ? anchorLeft + (maxWidth - (line.bounds.maxX - line.bounds.minX)) / 2 - line.bounds.minX
      : 0

    for (const placement of line.placements) {
      const shifted: GlyphPlacement = {
        grapheme: placement.grapheme,
        x: placement.x + shiftX,
        baselineY: placement.baselineY + offsetY,
        advanceWidth: placement.advanceWidth,
        bounds: offsetBounds(placement.bounds, shiftX, offsetY),
        skew: placement.skew,
      }
      placements.push(shifted)
      bounds = bounds ? mergeBounds(bounds, shifted.bounds) : shifted.bounds
    }
  })

  return {
    placements,
    bounds: bounds ?? emptyBounds(),
    letterSpacing: options.letterSpacing,
    fontSize: options.fontSize,
    glyphTransform,
  }
}

function layoutLine(
  text: string,
  options: {
    fontSize: number
    verticalSkewDeg: number
    alternatingOffset: number
    letterSpacing: number
    measureGlyph: (grapheme: string, fontSize: number) => GlyphMeasurement
  },
): { placements: GlyphPlacement[]; bounds: Bounds | null } {
  const graphemes = splitGraphemes(text)
  const letterSpacing = options.letterSpacing
  // 垂直斜切的正切：把词内字母的锚点沿倾斜基线预先下压，实现整词连续倾斜。
  const verticalSkewTangent = Math.tan((options.verticalSkewDeg * Math.PI) / 180)

  const placements: GlyphPlacement[] = []
  let cursorX = 0
  let bounds: Bounds | null = null

  // 一个“单元”是一个攀登步。每个 CJK 字符自成一个单元，而连续的拉丁词字符
  // 共享同一个单元（因而共享同一个 baselineY），使英文词内所有字母坐落同一高度。
  let unitIndex = -1
  let prevKind: GraphemeKind | null = null
  // 当前攀登单元起点的水平笔位；词内字母以此为参照计算 unitOffsetX。
  let unitStartX = 0

  graphemes.forEach((grapheme) => {
    const kind = classifyGrapheme(grapheme)

    if (kind === 'space') {
      const measurement = options.measureGlyph(grapheme, options.fontSize)
      cursorX += Math.max(0, measurement.advanceWidth * SPACE_ADVANCE_SCALE)
      prevKind = 'space'
      return
    }

    const continuesWord = kind === 'word' && prevKind === 'word'
    if (!continuesWord) {
      unitIndex += 1
      unitStartX = cursorX
    }

    const measurement = options.measureGlyph(grapheme, options.fontSize)
    const canSkew = !isEmojiGrapheme(grapheme)
    // 字母相对所属单元起点的水平偏移；CJK/Emoji 自成一个单元恒为 0。
    const unitOffsetX = cursorX - unitStartX
    const skewedBounds = measureSkewedGlyphBounds(
      measurement,
      canSkew ? options.verticalSkewDeg : 0,
    )
    // 词内字母的锚点沿倾斜基线预先下压 tan(垂直斜切)*词内偏移，叠加到攀登基线上。
    // 这样整个英文单词共享一条连续倾斜的基线，绘制时逐字形的垂直斜切便自然首尾相接，
    // 消除了原先每个字母各自以自身锚点倾斜导致的参差。
    const wordTiltY = canSkew ? verticalSkewTangent * unitOffsetX : 0
    const baselineY =
      getAlternatingOffset(unitIndex, options.alternatingOffset) + wordTiltY
    const placementBounds = offsetBounds(skewedBounds, cursorX, baselineY)

    placements.push({
      grapheme,
      x: cursorX,
      baselineY,
      advanceWidth: measurement.advanceWidth,
      bounds: placementBounds,
      skew: canSkew,
    })

    bounds = bounds ? mergeBounds(bounds, placementBounds) : placementBounds
    cursorX += measurement.advanceWidth + letterSpacing
    prevKind = kind
  })

  return { placements, bounds }
}

export function thresholdAlphaMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): BinaryMask {
  const data = new Uint8ClampedArray(width * height)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = alpha[index] >= threshold ? 255 : 0
  }

  return { width, height, data }
}

export function dilateMaskRound(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  const squaredDistances = computeSquaredDistanceTransform(mask)
  const data = new Uint8ClampedArray(mask.data.length)
  const radiusSquared = radius * radius

  for (let index = 0; index < data.length; index += 1) {
    data[index] = squaredDistances[index] <= radiusSquared ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

export function erodeMaskRound(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  return invertMask(dilateMaskRound(invertMask(mask), radius))
}

export function subtractMask(
  source: BinaryMask,
  subtractor: BinaryMask,
): BinaryMask {
  const data = new Uint8ClampedArray(source.data.length)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = source.data[index] > 0 && subtractor.data[index] === 0 ? 255 : 0
  }

  return { width: source.width, height: source.height, data }
}

export function findOpaqueBounds(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): OpaqueBounds | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] === 0) {
        continue
      }

      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right === -1) {
    return null
  }

  return { left, top, right, bottom }
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

export async function renderSticker(
  controls: StickerControls,
  iconBitmap: ImageBitmap | null = null,
): Promise<RenderResult> {
  const trimmedText = controls.text.trim()
  if (trimmedText.length === 0) {
    throw new Error('Text is required for sticker export.')
  }

  await ensureStickerFontLoaded(controls.flavor)

  // 字符倾斜关闭时，剥离字面固有的旋转与斜切、只保留缩放，让字形直立。
  const baseTransform = fontGlyphTransform(controls.flavor)
  const glyphTransform: GlyphTransform = controls.tilt
    ? baseTransform
    : { scale: baseTransform.scale, rotationDeg: 0, skewDeg: [0, 0] }

  const layout = createStickerLayout(trimmedText, {
    fontSize: controls.fontSize,
    letterSpacing: controls.letterSpacing,
    lineHeight: controls.lineHeight,
    glyphTransform,
    alternatingOffset: controls.peak ? controls.alternatingOffset : 0,
    measureGlyph: (grapheme, fontSize) =>
      measureGlyphWithCanvas(grapheme, fontSize, controls.flavor),
  })

  const iconBox = iconBitmap
    ? computeIconBox(iconBitmap, layout, controls.fontSize)
    : null
  const contentBounds = iconBox
    ? mergeBounds(layout.bounds, iconBox)
    : layout.bounds

  const padding = calculateWorkingPadding(controls)
  const workingWidth = Math.max(
    1,
    Math.ceil(contentBounds.maxX - contentBounds.minX + padding * 2),
  )
  const workingHeight = Math.max(
    1,
    Math.ceil(contentBounds.maxY - contentBounds.minY + padding * 2),
  )
  const originX = padding - contentBounds.minX
  const originY = padding - contentBounds.minY

  const sourceMaskCanvas = createCanvas(workingWidth, workingHeight)
  const sourceMaskContext = getContext(sourceMaskCanvas)
  resetAndPrepareTextContext(sourceMaskContext, controls.fontSize, controls.flavor)
  sourceMaskContext.fillStyle = '#ffffff'
  // 蒙版只纳入文字字形与图标；Emoji 排除在外——它们随后以原生彩色单独绘制，
  // 既保留真实配色，又不让其抗锯齿边缘被阈值化后的杂散点参与描边膨胀。
  drawFilledGlyphs(sourceMaskContext, layout, originX, originY, isTextPlacement)
  if (iconBitmap && iconBox) {
    drawIcon(sourceMaskContext, iconBitmap, iconBox, originX, originY)
  }

  const sourceMask = thresholdAlphaMask(
    extractAlphaChannel(
      sourceMaskContext.getImageData(0, 0, workingWidth, workingHeight).data,
    ),
    workingWidth,
    workingHeight,
    ALPHA_THRESHOLD,
  )
  // 两种展示字面使用不同的配色模型，分别对应各自的源表情包：
  //   • snh / 勇攀高峰 (抖音美好体)：白色字形置于彩色渐变包体内，带较深的边缘轮廓。
  //   • bs  / 字节范  (优设标题黑)：彩色渐变字形，直接由更深的同色系轮廓包裹（无白色描边）。
  // 每一条带都是字形蒙版的圆角 Minkowski 膨胀；外层带的内轮廓会做泛洪填充，
  // 使细小的孔洞保持实心。
  const outputCanvas = createCanvas(workingWidth, workingHeight)
  const outputContext = getContext(outputCanvas)

  // 把用户颜色规整为实际停靠点（单色自动补出同色系深色，方向由角度旋钮控制）。
  const gradientStops = resolveGradientStops(controls.envelope.colors)

  const paintFamilyGradient = (
    context: OffscreenCanvasRenderingContext2D,
    stops: string[],
  ) => {
    context.fillStyle = createGradient(
      context,
      workingWidth,
      workingHeight,
      controls.envelope.gradientAngle,
      stops,
    )
    context.fillRect(0, 0, workingWidth, workingHeight)
  }

  const paintSolid = (
    context: OffscreenCanvasRenderingContext2D,
    color: string,
  ) => {
    context.fillStyle = color
    context.fillRect(0, 0, workingWidth, workingHeight)
  }

  if (controls.flavor === 'snh') {
    // 白色字形置于彩色包体内并带较深的边缘轮廓，另在字形下方叠加 multiply 混合
    // 阴影，使白字读起来像是浮在彩色主体之上（匹配源表情包）。
    const bandWidth = controls.envelope.outlineStrokeWidth
    const envelopeMask = fillEnclosedRegions(
      dilateMaskRound(sourceMask, bandWidth),
    )
    const edgeMask = subtractMask(
      envelopeMask,
      erodeMaskRound(envelopeMask, controls.envelope.edgeWidth),
    )
    const envelopeMaskCanvas = maskToCanvas(envelopeMask, ENVELOPE_ANTIALIAS)
    const edgeMaskCanvas = maskToCanvas(edgeMask, OUTLINE_ANTIALIAS)
    const glyphMaskCanvas = maskToCanvas(sourceMask, OUTLINE_ANTIALIAS)

    // 彩色渐变主体。
    paintMask(outputContext, envelopeMaskCanvas, (context) =>
      paintFamilyGradient(context, gradientStops),
    )
    // 较深的边缘轮廓，用 multiply 混合使其读起来像阴影化的边框。
    paintMask(
      outputContext,
      edgeMaskCanvas,
      (context) =>
        paintFamilyGradient(
          context,
          gradientStops.map((color) => darken(color, 0.45)),
        ),
      controls.envelope.edgeOpacity,
      'multiply',
    )
    // 内阴影：将字形偏移并模糊后裁剪到包体内、以 multiply 混入，压暗字母正下方的主体。
    if (controls.shadow.opacity > 0) {
      paintMask(
        outputContext,
        envelopeMaskCanvas,
        (context) => {
          context.fillStyle = controls.shadow.color
          context.filter = `blur(${controls.shadow.blur}px)`
          configureTextContext(context, controls.fontSize, controls.flavor)
          drawFilledGlyphs(
            context,
            layout,
            originX + controls.shadow.offsetX,
            originY + controls.shadow.offsetY,
          )
        },
        controls.shadow.opacity,
        'multiply',
      )
    }
    // 顶层白色字形。
    paintMask(outputContext, glyphMaskCanvas, (context) =>
      paintSolid(context, '#ffffff'),
    )
  } else {
    // 彩色字形直接由加深的同色系外层带包裹——没有白色描边。外扩部分就是加深后的颜色本身。
    const rimWidth =
      controls.envelope.outlineStrokeWidth + controls.envelope.edgeWidth
    const deepMask = fillEnclosedRegions(dilateMaskRound(sourceMask, rimWidth))
    const deepMaskCanvas = maskToCanvas(deepMask, ENVELOPE_ANTIALIAS)
    const glyphMaskCanvas = maskToCanvas(sourceMask, OUTLINE_ANTIALIAS)

    // 外层带：加深后的同族渐变。
    paintMask(outputContext, deepMaskCanvas, (context) =>
      paintFamilyGradient(
        context,
        gradientStops.map((color) => darken(color, 0.42)),
      ),
    )
    // 前景层：字形与图标，填充同族渐变。使用字形蒙版（而非 fillText）能让整个词
    // 保持一条连续的渐变，并把图标重新着色以匹配。
    paintMask(outputContext, glyphMaskCanvas, (context) =>
      paintFamilyGradient(context, gradientStops),
    )
  }

  // Emoji 以原生彩色叠加在最上层（不参与蒙版着色，保留其真实配色）。
  drawColorEmoji(
    outputContext,
    layout,
    controls.fontSize,
    controls.flavor,
    originX,
    originY,
  )

  const croppedCanvas = cropCanvas(outputCanvas)
  // 以「文字内容高度」（不含描边）为稳定参照来缩放：描边越厚，裁剪画布相对内容越大，
  // 缩放后整体尺寸随之增大，从而在导出与预览棋盘格上真实反映描边厚度。
  const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY)
  const exportScale = EXPORT_TEXT_HEIGHT / contentHeight
  const resizedCanvas = resizeCanvasByScale(
    croppedCanvas,
    exportScale,
    MAX_EXPORT_EDGE,
  )
  const exportCanvas = padCanvas(
    resizedCanvas,
    controls.padding.x,
    controls.padding.y,
  )

  return {
    canvas: exportCanvas,
    width: exportCanvas.width,
    height: exportCanvas.height,
    toBlob: () => canvasToPngBlob(exportCanvas),
    toBitmap: () => exportCanvas.transferToImageBitmap(),
  }
}

function calculateWorkingPadding(controls: StickerControls): number {
  return Math.ceil(
    controls.fontSize * 0.7 +
      controls.envelope.outlineStrokeWidth * 2.5 +
      controls.envelope.edgeWidth * 2 +
      Math.abs(controls.alternatingOffset) +
      controls.shadow.blur * 2 +
      Math.max(
        Math.abs(controls.shadow.offsetX),
        Math.abs(controls.shadow.offsetY),
      ),
  )
}

function resetAndPrepareTextContext(
  context: OffscreenCanvasRenderingContext2D,
  fontSize: number,
  flavor: StickerFlavor,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  configureTextContext(context, fontSize, flavor)
}

function configureTextContext(
  context: OffscreenCanvasRenderingContext2D,
  fontSize: number,
  flavor: StickerFlavor,
): void {
  context.font = fontSpec(flavor, fontSize)
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
}

function drawFilledGlyphs(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
  filter?: (placement: GlyphPlacement) => boolean,
): void {
  drawPlacedGlyphs(
    context,
    layout,
    originX,
    originY,
    (current, grapheme) => {
      current.fillText(grapheme, 0, 0)
    },
    filter,
  )
}

// 文字字形（非 Emoji）——它们走单色蒙版着色管线。
function isTextPlacement(placement: GlyphPlacement): boolean {
  return !isEmojiGrapheme(placement.grapheme)
}

// 以 Emoji 原生彩色直接绘制到目标画布（不经蒙版重着色，从而保留其真实配色，
// 也避免把其抗锯齿边缘阈值化后残留的杂散“角点”带进描边膨胀）。
function drawColorEmoji(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  fontSize: number,
  flavor: StickerFlavor,
  originX: number,
  originY: number,
): void {
  const hasEmoji = layout.placements.some((placement) => !isTextPlacement(placement))
  if (!hasEmoji) return

  context.save()
  configureTextContext(context, fontSize, flavor)
  drawPlacedGlyphs(
    context,
    layout,
    originX,
    originY,
    (current, grapheme) => {
      current.fillText(grapheme, 0, 0)
    },
    (placement) => !isTextPlacement(placement),
  )
  context.restore()
}

function drawPlacedGlyphs(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
  painter: (context: OffscreenCanvasRenderingContext2D, grapheme: string) => void,
  filter?: (placement: GlyphPlacement) => boolean,
): void {
  const { scale, rotationDeg, skewDeg } = layout.glyphTransform
  const [scaleX, scaleY] = scale
  const rotationRad = (rotationDeg * Math.PI) / 180
  const horizontalSkewTangent = Math.tan((skewDeg[0] * Math.PI) / 180)
  const verticalSkewTangent = Math.tan((skewDeg[1] * Math.PI) / 180)

  for (const placement of layout.placements) {
    if (filter && !filter(placement)) continue
    context.save()
    // 锚定在字形的基线左端；下面每一步整形都以此为中心。
    context.translate(originX + placement.x, originY + placement.baselineY)
    if (placement.skew) {
      // 每字体的字形整形（仅文字——Emoji 保持直立）。可在
      // FONT_REGISTRY[...].transform 中精调。
      // 1) 缩放（水平 / 垂直）
      if (scaleX !== 1 || scaleY !== 1) {
        context.scale(scaleX, scaleY)
      }
      // 2) 逆时针旋转（正 rotationDeg = 屏幕坐标下的逆时针）
      if (rotationRad !== 0) {
        context.rotate(-rotationRad)
      }
      // 3) 水平斜切：x' = x + tan(水平) * y
      if (horizontalSkewTangent !== 0) {
        context.transform(1, 0, horizontalSkewTangent, 1, 0, 0)
      }
      // 4) 垂直斜切：y' = y + tan(垂直) * x（字面固有的竖向倾斜）
      if (verticalSkewTangent !== 0) {
        context.transform(1, verticalSkewTangent, 0, 1, 0, 0)
      }
    }
    painter(context, placement.grapheme)
    context.restore()
  }
}

interface IconBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

// 将图标缩放到第一行文字的字高，并放在字形左侧，在该行内垂直居中。
function computeIconBox(
  iconBitmap: ImageBitmap,
  layout: StickerLayout,
  fontSize: number,
): IconBox {
  const size = fontSize * 0.86
  const aspect = iconBitmap.width / iconBitmap.height || 1
  const drawWidth = size * aspect
  const gap = fontSize * 0.18

  const first = layout.placements[0]
  const lineTop = first ? first.baselineY - fontSize * 0.72 : -fontSize * 0.72
  const centerY = lineTop + size / 2

  const maxX = layout.bounds.minX - gap
  const minX = maxX - drawWidth
  return {
    minX,
    minY: centerY - size / 2,
    maxX,
    maxY: centerY + size / 2,
  }
}

function drawIcon(
  context: OffscreenCanvasRenderingContext2D,
  iconBitmap: ImageBitmap,
  box: IconBox,
  originX: number,
  originY: number,
): void {
  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    iconBitmap,
    originX + box.minX,
    originY + box.minY,
    box.maxX - box.minX,
    box.maxY - box.minY,
  )
  context.restore()
}

export function fillEnclosedRegions(mask: BinaryMask): BinaryMask {
  const { width, height, data } = mask
  const exterior = new Uint8Array(data.length)
  const stack: number[] = []

  const pushIfBackground = (index: number) => {
    if (data[index] === 0 && exterior[index] === 0) {
      exterior[index] = 1
      stack.push(index)
    }
  }

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x)
    pushIfBackground((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(y * width)
    pushIfBackground(y * width + width - 1)
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % width
    const y = (index - x) / width

    if (x > 0) pushIfBackground(index - 1)
    if (x < width - 1) pushIfBackground(index + 1)
    if (y > 0) pushIfBackground(index - width)
    if (y < height - 1) pushIfBackground(index + width)
  }

  const result = new Uint8ClampedArray(data.length)
  for (let index = 0; index < data.length; index += 1) {
    result[index] = data[index] > 0 || exterior[index] === 0 ? 255 : 0
  }

  return { width, height, data: result }
}

function extractAlphaChannel(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(rgba.length / 4)

  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rgba[index * 4 + 3]
  }

  return alpha
}

function createGradient(
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  angleDeg: number,
  stops: string[],
): CanvasGradient {
  const angle = ((angleDeg - 90) * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const halfLength = (Math.abs(dx) * width + Math.abs(dy) * height) / 2
  const centerX = width / 2
  const centerY = height / 2
  const gradient = context.createLinearGradient(
    centerX - dx * halfLength,
    centerY - dy * halfLength,
    centerX + dx * halfLength,
    centerY + dy * halfLength,
  )

  // 单色时兜底重复，其余按停靠点均匀分布。
  const list = stops.length > 0 ? stops : ['#000000']
  if (list.length === 1) {
    gradient.addColorStop(0, list[0])
    gradient.addColorStop(1, list[0])
  } else {
    list.forEach((color, index) => {
      gradient.addColorStop(index / (list.length - 1), color)
    })
  }
  return gradient
}

function maskToCanvas(mask: BinaryMask, softenRadius = 0): OffscreenCanvas {
  const baseCanvas = createCanvas(mask.width, mask.height)
  const baseContext = getContext(baseCanvas)
  const imageData = baseContext.createImageData(mask.width, mask.height)
  const alpha = softenRadius > 0 ? createAntialiasedAlpha(mask, softenRadius) : mask.data

  for (let index = 0; index < mask.data.length; index += 1) {
    const rgbaIndex = index * 4
    imageData.data[rgbaIndex] = 255
    imageData.data[rgbaIndex + 1] = 255
    imageData.data[rgbaIndex + 2] = 255
    imageData.data[rgbaIndex + 3] = alpha[index]
  }

  baseContext.putImageData(imageData, 0, 0)
  return baseCanvas
}

function paintMask(
  targetContext: OffscreenCanvasRenderingContext2D,
  maskCanvas: OffscreenCanvas,
  painter: (context: OffscreenCanvasRenderingContext2D) => void,
  opacity = 1,
  compositeOperation: GlobalCompositeOperation = 'source-over',
): void {
  const temporaryCanvas = createCanvas(maskCanvas.width, maskCanvas.height)
  const temporaryContext = getContext(temporaryCanvas)

  painter(temporaryContext)
  temporaryContext.globalCompositeOperation = 'destination-in'
  temporaryContext.drawImage(maskCanvas, 0, 0)

  targetContext.save()
  targetContext.globalAlpha = opacity
  targetContext.globalCompositeOperation = compositeOperation
  targetContext.drawImage(temporaryCanvas, 0, 0)
  targetContext.restore()
}

function cropCanvas(sourceCanvas: OffscreenCanvas): OffscreenCanvas {
  const sourceContext = getContext(sourceCanvas)
  const imageData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  )
  const bounds = findOpaqueBounds(
    extractAlphaChannel(imageData.data),
    sourceCanvas.width,
    sourceCanvas.height,
  )

  if (!bounds) {
    throw new Error('Rendered canvas is empty.')
  }

  const left = bounds.left
  const top = bounds.top
  const width = bounds.right - left + 1
  const height = bounds.bottom - top + 1

  const croppedCanvas = createCanvas(width, height)
  const croppedContext = getContext(croppedCanvas)
  croppedContext.drawImage(
    sourceCanvas,
    left,
    top,
    width,
    height,
    0,
    0,
    width,
    height,
  )
  return croppedCanvas
}

// 在导出的表情包四周添加透明留白。X 与 Y 相互独立，因此默认可以让左右保持紧凑，
// 同时给上下正常的间距。
function padCanvas(
  sourceCanvas: OffscreenCanvas,
  paddingX: number,
  paddingY: number,
): OffscreenCanvas {
  const x = Math.max(0, Math.round(paddingX))
  const y = Math.max(0, Math.round(paddingY))
  if (x === 0 && y === 0) {
    return sourceCanvas
  }

  const width = sourceCanvas.width + x * 2
  const height = sourceCanvas.height + y * 2
  const paddedCanvas = createCanvas(width, height)
  const paddedContext = getContext(paddedCanvas)
  paddedContext.drawImage(sourceCanvas, x, y)
  return paddedCanvas
}

function resizeCanvasByScale(
  sourceCanvas: OffscreenCanvas,
  scale: number,
  maxEdge: number,
): OffscreenCanvas {
  const scaledWidth = Math.max(1, Math.round(sourceCanvas.width * scale))
  const scaledHeight = Math.max(1, Math.round(sourceCanvas.height * scale))
  const longestEdge = Math.max(scaledWidth, scaledHeight)
  const clampScale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
  const outputWidth = Math.max(1, Math.round(scaledWidth * clampScale))
  const outputHeight = Math.max(1, Math.round(scaledHeight * clampScale))
  const canvas = createCanvas(outputWidth, outputHeight)
  const context = getContext(canvas)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(sourceCanvas, 0, 0, outputWidth, outputHeight)
  return canvas
}

function canvasToPngBlob(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/png' })
}

function measureGlyphWithCanvas(
  grapheme: string,
  fontSize: number,
  flavor: StickerFlavor,
): GlyphMeasurement {
  const canvas = measurementCanvas ?? createCanvas(1, 1)
  measurementCanvas = canvas
  const context = getContext(canvas)
  context.font = fontSpec(flavor, fontSize)
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

function cloneMask(mask: BinaryMask): BinaryMask {
  return {
    width: mask.width,
    height: mask.height,
    data: new Uint8ClampedArray(mask.data),
  }
}

function createAntialiasedAlpha(
  mask: BinaryMask,
  featherRadius: number,
): Uint8ClampedArray {
  const outsideDistances = computeSquaredDistanceTransform(mask)
  const insideDistances = computeSquaredDistanceTransform(invertMask(mask))
  const alpha = new Uint8ClampedArray(mask.data.length)
  const feather = Math.max(0.01, featherRadius)

  for (let index = 0; index < alpha.length; index += 1) {
    const signedDistance =
      Math.sqrt(outsideDistances[index]) - Math.sqrt(insideDistances[index])
    const normalized = clampUnitInterval(0.5 - signedDistance / (2 * feather))
    alpha[index] = Math.round(normalized * 255)
  }

  return alpha
}

function invertMask(mask: BinaryMask): BinaryMask {
  const data = new Uint8ClampedArray(mask.data.length)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = mask.data[index] === 0 ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

function computeSquaredDistanceTransform(mask: BinaryMask): Float64Array {
  const { width, height } = mask
  const temporary = new Float64Array(width * height)
  const distances = new Float64Array(width * height)
  const column = new Float64Array(Math.max(width, height))
  const columnDistances = new Float64Array(Math.max(width, height))

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      column[y] = mask.data[y * width + x] > 0 ? 0 : DISTANCE_INF
    }

    transformDistanceAxis(column, height, columnDistances)

    for (let y = 0; y < height; y += 1) {
      temporary[y * width + x] = columnDistances[y]
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      column[x] = temporary[y * width + x]
    }

    transformDistanceAxis(column, width, columnDistances)

    for (let x = 0; x < width; x += 1) {
      distances[y * width + x] = columnDistances[x]
    }
  }

  return distances
}

function transformDistanceAxis(
  source: Float64Array,
  length: number,
  target: Float64Array,
): void {
  const vertices = new Int32Array(length)
  const boundaries = new Float64Array(length + 1)
  let hullSize = 0

  vertices[0] = 0
  boundaries[0] = Number.NEGATIVE_INFINITY
  boundaries[1] = Number.POSITIVE_INFINITY

  for (let position = 1; position < length; position += 1) {
    let intersection = calculateSeparation(
      source,
      position,
      vertices[hullSize],
    )

    while (intersection <= boundaries[hullSize]) {
      hullSize -= 1
      intersection = calculateSeparation(
        source,
        position,
        vertices[hullSize],
      )
    }

    hullSize += 1
    vertices[hullSize] = position
    boundaries[hullSize] = intersection
    boundaries[hullSize + 1] = Number.POSITIVE_INFINITY
  }

  hullSize = 0

  for (let position = 0; position < length; position += 1) {
    while (boundaries[hullSize + 1] < position) {
      hullSize += 1
    }

    const distance = position - vertices[hullSize]
    target[position] = distance * distance + source[vertices[hullSize]]
  }
}

function calculateSeparation(
  source: Float64Array,
  current: number,
  previous: number,
): number {
  return (
    (source[current] + current * current - (source[previous] + previous * previous)) /
    (2 * current - 2 * previous)
  )
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function createCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(
    Math.max(1, Math.ceil(width)),
    Math.max(1, Math.ceil(height)),
  )
}

function getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    throw new Error('2D canvas context is unavailable.')
  }

  return context
}

function mergeBounds(left: Bounds, right: Bounds): Bounds {
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  }
}

function offsetBounds(bounds: Bounds, offsetX: number, offsetY: number): Bounds {
  return {
    minX: bounds.minX + offsetX,
    minY: bounds.minY + offsetY,
    maxX: bounds.maxX + offsetX,
    maxY: bounds.maxY + offsetY,
  }
}

function emptyBounds(): Bounds {
  return {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  }
}
