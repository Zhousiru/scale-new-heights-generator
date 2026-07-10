import {
  normalizeRenderScale,
  type StickerControls,
} from '../config/defaults'
import { darken, lighten, resolveGradientStops } from '../utils/color'
import {
  effectiveOutlineWidth,
  ensureStickerFontLoaded,
  fontGlyphTransform,
  iconGlyphTransformFrom,
  isChineseDominant,
  measureGlyphWithCanvas,
} from './font'
import {
  createStickerLayout,
  isEmojiGrapheme,
  mergeBounds,
} from './layout'
import {
  computeSquaredDistanceTransform,
  dilateMaskRound,
  erodeMaskRound,
  fillEnclosedRegions,
  invertMask,
  subtractMask,
  thresholdAlphaMask,
} from './mask'
import {
  cropResizePadCanvas,
  extractAlphaChannel,
  getContext,
} from './canvas'
import {
  createGradient,
  gradientExtentFromMask,
} from './gradient'
import { maskToCanvas, paintMask, createPaintBuffer } from './paint'
import { createRuntimeCanvas } from './runtime'
import {
  configureTextContext,
  computeIconBox,
  drawColorEmoji,
  drawEmojiGlyphs,
  drawFilledGlyphs,
  drawIcon,
  isTextPlacement,
  resetAndPrepareTextContext,
} from './glyphs'
import {
  IDENTITY_GLYPH_TRANSFORM,
  type GradientExtent,
  type GlyphTransform,
  type OpaqueBounds,
  type RenderIcon,
  type RenderResult,
} from './types'

// 导出时文字（内容）本身归一化到的目标高度。注意这里参照的是「文字/内容」的高度
// （不含描边），而非含描边的画布总高度。这样描边加粗时，裁剪后的画布随之外扩变大、
// 文字尺寸保持稳定，导出图片（以及预览的棋盘格背景）会真实反映描边厚度的变化。
const EXPORT_TEXT_HEIGHT = 150
const MAX_EXPORT_EDGE = 2048
const ENVELOPE_ANTIALIAS = 1.1
const OUTLINE_ANTIALIAS = 0.9
const ALPHA_THRESHOLD = 16
const BYTE_OUTLINE_DARKEN = 0.4
const BYTE_FOREGROUND_LIGHTEN = 0.4

export interface RenderStickerOptions {
  /** 导出像素倍率。浏览器 UI 默认 1；Node/机器人可用 2~3 生成更高清图片。 */
  outputScale?: number
  /** 内部超采样倍率。默认跟随 controls，未配置时为 1.5，用于平滑斜线和斜切边缘。 */
  antialiasScale?: number
  /** 限制导出图片最长边，避免机器人上传过大图片。 */
  maxOutputEdge?: number
}

export async function renderSticker(
  controls: StickerControls,
  icon: RenderIcon | null = null,
  options: RenderStickerOptions = {},
): Promise<RenderResult> {
  const text = controls.text
  if (text.length === 0) {
    throw new Error('Text is required for sticker export.')
  }

  const iconBitmap = icon?.bitmap ?? null
  // 多色 / duotone 图标顶层原生叠加；单色图标折进蒙版由文字配色统一重着色。
  const iconColored = icon?.colored ?? false

  await ensureStickerFontLoaded(controls.flavor)

  const antialiasScale = options.antialiasScale ?? controls.antialiasScale
  const renderControls = scaleControlsForRasterization(controls, antialiasScale)

  // 字符倾斜关闭时，剥离字面固有的旋转与斜切、只保留缩放，让字形直立。
  const baseTransform = fontGlyphTransform(renderControls.flavor)
  const glyphTransform: GlyphTransform = controls.tilt
    ? baseTransform
    : { scale: baseTransform.scale, rotationDeg: 0, skewDeg: [0, 0] }
  const iconGlyphTransform = controls.iconTilt
    ? iconGlyphTransformFrom(baseTransform)
    : IDENTITY_GLYPH_TRANSFORM

  const chineseDominant = isChineseDominant(text)
  const layout = createStickerLayout(text, {
    fontSize: renderControls.fontSize,
    letterSpacing: renderControls.letterSpacing,
    lineHeight: renderControls.lineHeight,
    flavor: renderControls.flavor,
    glyphTransform,
    alternatingOffset: renderControls.peak ? renderControls.alternatingOffset : 0,
    measureGlyph: (grapheme, fontSize) =>
      measureGlyphWithCanvas(grapheme, fontSize, renderControls.flavor, chineseDominant),
  })

  const iconBox = iconBitmap
    ? computeIconBox(
      iconBitmap,
      layout,
      renderControls.fontSize,
      iconGlyphTransform,
    )
    : null
  const contentBounds = iconBox
    ? mergeBounds(layout.bounds, iconBox)
    : layout.bounds

  const padding = calculateWorkingPadding(renderControls)
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

  const maskCanvas = createRuntimeCanvas(workingWidth, workingHeight)
  const maskContext = getContext(maskCanvas)
  resetAndPrepareTextContext(
    maskContext,
    renderControls.fontSize,
    renderControls.flavor,
  )
  maskContext.fillStyle = '#ffffff'
  // 前景蒙版只纳入非 Emoji 字形与图标，用于后续白字/渐变字重着色。
  drawFilledGlyphs(maskContext, layout, originX, originY, isTextPlacement)
  if (iconBitmap && iconBox) {
    drawIcon(
      maskContext,
      iconBitmap,
      iconBox,
      originX,
      originY,
      iconGlyphTransform,
    )
  }

  const foregroundMask = thresholdAlphaMask(
    extractAlphaChannel(
      maskContext.getImageData(0, 0, workingWidth, workingHeight).data,
    ),
    workingWidth,
    workingHeight,
    ALPHA_THRESHOLD,
  )

  const hasEmoji = layout.placements.some((placement) =>
    isEmojiGrapheme(placement.grapheme),
  )
  let shapeMask = foregroundMask
  if (hasEmoji) {
    // 形状蒙版在同一张画布上追加 Emoji，用于生成包体/描边；Emoji 只拿干净
    // alpha 参与外轮廓，本体稍后仍以原生彩色顶层叠加。
    drawEmojiGlyphs(
      maskContext,
      layout,
      renderControls.fontSize,
      renderControls.flavor,
      originX,
      originY,
    )
    shapeMask = thresholdAlphaMask(
      extractAlphaChannel(
        maskContext.getImageData(0, 0, workingWidth, workingHeight).data,
      ),
      workingWidth,
      workingHeight,
      ALPHA_THRESHOLD,
    )
  }
  // 两种展示字面使用不同的配色模型，分别对应各自的源表情包：
  //   • snh / 勇攀高峰 (抖音美好体)：白色字形置于彩色渐变包体内，带较深的边缘轮廓。
  //   • bs  / 字节范  (优设标题黑)：彩色渐变字形，直接由更深的同色系轮廓包裹（无白色描边）。
  // 每一条带都是字形蒙版的圆角 Minkowski 膨胀；外层带的内轮廓会做泛洪填充，
  // 使细小的孔洞保持实心。
  const outputCanvas = createRuntimeCanvas(workingWidth, workingHeight)
  const outputContext = getContext(outputCanvas)

  // 把用户颜色规整为实际停靠点（单色自动补出同色系深色，方向由角度旋钮控制）。
  const gradientStops = resolveGradientStops(renderControls.envelope.colors)

  const paintFamilyGradient = (
    context: OffscreenCanvasRenderingContext2D,
    stops: string[],
    extent: GradientExtent,
  ) => {
    context.fillStyle = createGradient(
      context,
      renderControls.envelope.gradientAngle,
      stops,
      extent,
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

  if (renderControls.flavor === 'snh') {
    // 白色字形置于彩色包体内并带较深的边缘轮廓，另在字形下方叠加 multiply 混合
    // 阴影，使白字读起来像是浮在彩色主体之上（匹配源表情包）。
    const bandWidth = effectiveOutlineWidth(
      renderControls.flavor,
      renderControls.envelope.outlineStrokeWidth,
    )

    // ① DT 缓存复用：shapeMask 的 DT 复用于 dilateMaskRound。
    const shapeMaskDT = computeSquaredDistanceTransform(shapeMask)
    const foregroundMaskDT = computeSquaredDistanceTransform(foregroundMask)
    const foregroundMaskInvertedDT = computeSquaredDistanceTransform(
      invertMask(foregroundMask),
    )

    const envelopeMask = fillEnclosedRegions(
      dilateMaskRound(shapeMask, bandWidth, shapeMaskDT),
    )
    // envelopeMask 的反转 DT 用于 erodeMaskRound
    const envelopeMaskInvertedDT = computeSquaredDistanceTransform(invertMask(envelopeMask))
    const edgeMask = subtractMask(
      envelopeMask,
      erodeMaskRound(envelopeMask, renderControls.envelope.edgeWidth, envelopeMaskInvertedDT),
    )

    // ① maskToCanvas 复用预计算 DT
    const envelopeMaskDT = computeSquaredDistanceTransform(envelopeMask)
    const envelopeMaskCanvas = maskToCanvas(
      envelopeMask, ENVELOPE_ANTIALIAS, envelopeMaskDT, envelopeMaskInvertedDT,
    )
    const edgeMaskDT = computeSquaredDistanceTransform(edgeMask)
    const edgeMaskInvertedDT = computeSquaredDistanceTransform(invertMask(edgeMask))
    const edgeMaskCanvas = maskToCanvas(
      edgeMask, OUTLINE_ANTIALIAS, edgeMaskDT, edgeMaskInvertedDT,
    )
    const glyphMaskCanvas = maskToCanvas(
      foregroundMask, OUTLINE_ANTIALIAS, foregroundMaskDT, foregroundMaskInvertedDT,
    )
    const envelopeGradientExtent = gradientExtentFromMask(
      envelopeMask,
      renderControls.envelope.gradientAngle,
    )

    // ③ 创建可复用的 paint buffer
    const buffer = createPaintBuffer(workingWidth, workingHeight)

    // 彩色渐变主体。
    paintMask(outputContext, envelopeMaskCanvas, (context) =>
      paintFamilyGradient(context, gradientStops, envelopeGradientExtent),
      1, 'source-over', buffer,
    )
    // 较深的边缘轮廓，用 multiply 混合使其读起来像阴影化的边框。
    paintMask(
      outputContext,
      edgeMaskCanvas,
      (context) =>
        paintFamilyGradient(
          context,
          gradientStops.map((color) => darken(color, 0.45)),
          envelopeGradientExtent,
        ),
      renderControls.envelope.edgeOpacity,
      'multiply',
      buffer,
    )
    // 内阴影：将字形（含前缀图标）偏移并模糊后裁剪到包体内、以 multiply 混入，
    // 压暗字母正下方的主体。图标与文字同属白色前景，需一并投影以保持一致。
    if (renderControls.shadow.opacity > 0) {
      paintMask(
        outputContext,
        envelopeMaskCanvas,
        (context) => {
          context.fillStyle = renderControls.shadow.color
          context.filter = `blur(${renderControls.shadow.blur}px)`
          configureTextContext(
            context,
            renderControls.fontSize,
            renderControls.flavor,
          )
          drawFilledGlyphs(
            context,
            layout,
            originX + renderControls.shadow.offsetX,
            originY + renderControls.shadow.offsetY,
          )
          if (iconBitmap && iconBox) {
            // 图标 drawImage 不吃 fillStyle；直接把图标 alpha 画进当前 paint buffer，
            // 再用 source-in 统一染成阴影色，避免额外分配一张全尺寸图标阴影画布。
            drawIcon(
              context,
              iconBitmap,
              iconBox,
              originX + renderControls.shadow.offsetX,
              originY + renderControls.shadow.offsetY,
              iconGlyphTransform,
            )
          }
          context.globalCompositeOperation = 'source-in'
          context.filter = 'none'
          context.fillStyle = renderControls.shadow.color
          context.fillRect(0, 0, workingWidth, workingHeight)
        },
        renderControls.shadow.opacity,
        'multiply',
        buffer,
      )
    }
    // 顶层白色字形。
    paintMask(outputContext, glyphMaskCanvas, (context) =>
      paintSolid(context, '#ffffff'),
      1, 'source-over', buffer,
    )
  } else {
    // 彩色字形直接由加深的同色系外层带包裹——没有白色描边。外扩部分就是加深后的颜色本身。
    const rimWidth = effectiveOutlineWidth(
      renderControls.flavor,
      renderControls.envelope.outlineStrokeWidth,
    )

    // ① DT 缓存复用
    const shapeMaskDT = computeSquaredDistanceTransform(shapeMask)
    const foregroundMaskDT = computeSquaredDistanceTransform(foregroundMask)
    const foregroundMaskInvertedDT = computeSquaredDistanceTransform(
      invertMask(foregroundMask),
    )

    const deepMask = fillEnclosedRegions(dilateMaskRound(shapeMask, rimWidth, shapeMaskDT))

    const deepMaskDT = computeSquaredDistanceTransform(deepMask)
    const deepMaskInvertedDT = computeSquaredDistanceTransform(invertMask(deepMask))
    const deepMaskCanvas = maskToCanvas(
      deepMask, ENVELOPE_ANTIALIAS, deepMaskDT, deepMaskInvertedDT,
    )
    const glyphMaskCanvas = maskToCanvas(
      foregroundMask, OUTLINE_ANTIALIAS, foregroundMaskDT, foregroundMaskInvertedDT,
    )
    const deepGradientExtent = gradientExtentFromMask(
      deepMask,
      renderControls.envelope.gradientAngle,
    )

    const byteOutlineStops = gradientStops.map((color) =>
      darken(color, BYTE_OUTLINE_DARKEN),
    )
    const byteForegroundStops = gradientStops.map((color) =>
      lighten(color, BYTE_FOREGROUND_LIGHTEN),
    )

    // ③ 创建可复用的 paint buffer
    const buffer = createPaintBuffer(workingWidth, workingHeight)

    // 配置色作为基准色；轮廓加深，文字只轻微提亮，保持清爽但不发白。
    paintMask(outputContext, deepMaskCanvas, (context) =>
      paintFamilyGradient(context, byteOutlineStops, deepGradientExtent),
      1, 'source-over', buffer,
    )
    // 前景层：字形与图标使用轻微提亮后的基准色。
    paintMask(outputContext, glyphMaskCanvas, (context) =>
      paintFamilyGradient(context, byteForegroundStops, deepGradientExtent),
      1, 'source-over', buffer,
    )
  }

  // Emoji 以原生彩色叠加在最上层（不参与蒙版着色，保留其真实配色）。
  drawColorEmoji(
    outputContext,
    layout,
    renderControls.fontSize,
    renderControls.flavor,
    originX,
    originY,
  )

  // 多色 / duotone 图标：剪影已折进蒙版拿到外描边包围带，此处再以原生颜色叠加在
  // 最上层，覆盖掉被统一重着色的白/渐变填充，保留图标自身配色。
  if (iconColored && iconBitmap && iconBox) {
    drawIcon(
      outputContext,
      iconBitmap,
      iconBox,
      originX,
      originY,
      iconGlyphTransform,
    )
  }

  // 以「文字内容高度」（不含描边）为稳定参照来缩放：描边越厚，裁剪画布相对内容越大，
  // 缩放后整体尺寸随之增大，从而在导出与预览棋盘格上真实反映描边厚度。
  const contentHeight = Math.max(1, contentBounds.maxY - contentBounds.minY)
  const outputScale = normalizeRenderScale(options.outputScale)
  const exportScale = (EXPORT_TEXT_HEIGHT * outputScale) / contentHeight
  const exportCanvas = cropResizePadCanvas(
    outputCanvas,
    exportScale,
    options.maxOutputEdge ?? Math.round(MAX_EXPORT_EDGE * outputScale),
    controls.padding.x,
    controls.padding.y,
    boundsToCropBounds(contentBounds, originX, originY),
  )

  return {
    canvas: exportCanvas,
    width: exportCanvas.width,
    height: exportCanvas.height,
    toBlob: () => exportCanvas.convertToBlob({ type: 'image/png' }),
    toBitmap: () => exportCanvas.transferToImageBitmap(),
  }
}

function boundsToCropBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  originX: number,
  originY: number,
): OpaqueBounds {
  return {
    left: Math.floor(originX + bounds.minX),
    top: Math.floor(originY + bounds.minY),
    right: Math.ceil(originX + bounds.maxX) - 1,
    bottom: Math.ceil(originY + bounds.maxY) - 1,
  }
}

function scaleControlsForRasterization(
  controls: StickerControls,
  scale: number,
): StickerControls {
  if (scale === 1) return controls

  return {
    ...controls,
    fontSize: controls.fontSize * scale,
    letterSpacing: controls.letterSpacing * scale,
    alternatingOffset: controls.alternatingOffset * scale,
    shadow: {
      ...controls.shadow,
      offsetX: controls.shadow.offsetX * scale,
      offsetY: controls.shadow.offsetY * scale,
      blur: controls.shadow.blur * scale,
    },
    envelope: {
      ...controls.envelope,
      outlineStrokeWidth: controls.envelope.outlineStrokeWidth * scale,
      edgeWidth: controls.envelope.edgeWidth * scale,
    },
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
