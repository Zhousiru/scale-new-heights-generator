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
  cropResizePadCanvas,
  getContext,
} from './canvas'
import {
  createGradient,
} from './gradient'
import { fillEnclosedRegionsCanvas, gradientExtentFromCanvas } from './paint'
import { createRuntimeCanvas } from './runtime'
import {
  configureTextContext,
  computeIconBox,
  drawColorEmoji,
  drawEmojiGlyphs,
  drawFilledGlyphs,
  drawIcon,
  drawPlacedGlyphs,
  isTextPlacement,
} from './glyphs'
import {
  IDENTITY_GLYPH_TRANSFORM,
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

  const outputCanvas = createRuntimeCanvas(workingWidth, workingHeight)
  const outputContext = getContext(outputCanvas)

  // 把用户颜色规整为实际停靠点（单色自动补出同色系深色，方向由角度旋钮控制）。
  const gradientStops = resolveGradientStops(renderControls.envelope.colors)

  // ---------- Helper: draw non-emoji glyphs + icon with stroke and fill ----------
  const drawStrokeAndFill = (
    context: OffscreenCanvasRenderingContext2D,
    lineWidth: number,
    ox = originX,
    oy = originY,
  ) => {
    context.lineWidth = lineWidth
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.miterLimit = 2
    configureTextContext(context, renderControls.fontSize, renderControls.flavor)
    // draw text glyphs with stroke + fill
    drawPlacedGlyphs(context, layout, ox, oy, (ctx, grapheme) => {
      ctx.strokeText(grapheme, 0, 0)
      ctx.fillText(grapheme, 0, 0)
    }, isTextPlacement)
    // draw icon (if present, non-colored icons participate in outline)
    if (iconBitmap && iconBox) {
      drawIcon(context, iconBitmap, iconBox, ox, oy, iconGlyphTransform)
    }
    // draw emoji glyphs for shape contribution
    if (layout.placements.some((p) => isEmojiGrapheme(p.grapheme))) {
      drawEmojiGlyphs(context, layout, renderControls.fontSize, renderControls.flavor, ox, oy)
    }
  }

  // Helper: draw text glyphs fill-only
  const drawFillOnly = (
    context: OffscreenCanvasRenderingContext2D,
    ox = originX,
    oy = originY,
  ) => {
    configureTextContext(context, renderControls.fontSize, renderControls.flavor)
    drawFilledGlyphs(context, layout, ox, oy, isTextPlacement)
    if (iconBitmap && iconBox) {
      drawIcon(context, iconBitmap, iconBox, ox, oy, iconGlyphTransform)
    }
  }

  // Helper: create a solid filled shape canvas (stroke+fill+fillEnclosed)
  const createSolidShapeCanvas = (lineWidth: number): OffscreenCanvas => {
    const canvas = createRuntimeCanvas(workingWidth, workingHeight)
    const ctx = getContext(canvas)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#ffffff'
    drawStrokeAndFill(ctx, lineWidth)
    fillEnclosedRegionsCanvas(canvas)
    return canvas
  }

  if (renderControls.flavor === 'snh') {
    const bandWidth = effectiveOutlineWidth(
      renderControls.flavor,
      renderControls.envelope.outlineStrokeWidth,
    )

    // Layer 1: Envelope — dilated outline filled with gradient
    const envelopeCanvas = createSolidShapeCanvas(bandWidth * 2)
    const envelopeCtx = getContext(envelopeCanvas)
    const envelopeGradientExtent = gradientExtentFromCanvas(
      envelopeCanvas,
      renderControls.envelope.gradientAngle,
    )
    // Color with gradient via source-in compositing
    envelopeCtx.globalCompositeOperation = 'source-in'
    envelopeCtx.fillStyle = createGradient(
      envelopeCtx, renderControls.envelope.gradientAngle,
      gradientStops, envelopeGradientExtent,
    )
    envelopeCtx.fillRect(0, 0, workingWidth, workingHeight)
    outputContext.drawImage(envelopeCanvas, 0, 0)

    // Layer 2: Edge band — darkened ring between outer and inner boundary
    if (renderControls.envelope.edgeWidth > 0 && renderControls.envelope.edgeOpacity > 0) {
      const edgeCanvas = createSolidShapeCanvas(bandWidth * 2)
      const edgeCtx = getContext(edgeCanvas)
      // Build inner boundary on a SEPARATE canvas (also needs fillEnclosedRegions)
      const innerCanvas = createSolidShapeCanvas(
        Math.max(0, (bandWidth - renderControls.envelope.edgeWidth) * 2),
      )
      // Subtract inner from outer to leave only the edge ring
      edgeCtx.globalCompositeOperation = 'destination-out'
      edgeCtx.drawImage(innerCanvas, 0, 0)
      // Color the edge ring with darkened gradient
      edgeCtx.globalCompositeOperation = 'source-in'
      edgeCtx.fillStyle = createGradient(
        edgeCtx, renderControls.envelope.gradientAngle,
        gradientStops.map((color) => darken(color, 0.45)),
        envelopeGradientExtent,
      )
      edgeCtx.fillRect(0, 0, workingWidth, workingHeight)
      // Composite edge onto output with multiply blend
      outputContext.save()
      outputContext.globalAlpha = renderControls.envelope.edgeOpacity
      outputContext.globalCompositeOperation = 'multiply'
      outputContext.drawImage(edgeCanvas, 0, 0)
      outputContext.restore()
    }

    // Layer 3: Inner shadow
    if (renderControls.shadow.opacity > 0) {
      const shadowCanvas = createRuntimeCanvas(workingWidth, workingHeight)
      const shadowCtx = getContext(shadowCanvas)
      // Draw blurred shadow content first
      shadowCtx.fillStyle = renderControls.shadow.color
      shadowCtx.filter = `blur(${renderControls.shadow.blur}px)`
      configureTextContext(shadowCtx, renderControls.fontSize, renderControls.flavor)
      drawFilledGlyphs(
        shadowCtx, layout,
        originX + renderControls.shadow.offsetX,
        originY + renderControls.shadow.offsetY,
      )
      if (iconBitmap && iconBox) {
        drawIcon(
          shadowCtx, iconBitmap, iconBox,
          originX + renderControls.shadow.offsetX,
          originY + renderControls.shadow.offsetY,
          iconGlyphTransform,
        )
      }
      shadowCtx.globalCompositeOperation = 'source-in'
      shadowCtx.filter = 'none'
      shadowCtx.fillStyle = renderControls.shadow.color
      shadowCtx.fillRect(0, 0, workingWidth, workingHeight)
      // Clip shadow to the envelope shape
      const clipCanvas = createSolidShapeCanvas(bandWidth * 2)
      shadowCtx.globalCompositeOperation = 'destination-in'
      shadowCtx.drawImage(clipCanvas, 0, 0)
      // Composite shadow onto output
      outputContext.save()
      outputContext.globalAlpha = renderControls.shadow.opacity
      outputContext.globalCompositeOperation = 'multiply'
      outputContext.drawImage(shadowCanvas, 0, 0)
      outputContext.restore()
    }

    // Layer 4: White glyph fill on top
    const glyphCanvas = createRuntimeCanvas(workingWidth, workingHeight)
    const glyphCtx = getContext(glyphCanvas)
    glyphCtx.fillStyle = '#ffffff'
    drawFillOnly(glyphCtx)
    glyphCtx.globalCompositeOperation = 'source-in'
    glyphCtx.fillStyle = '#ffffff'
    glyphCtx.fillRect(0, 0, workingWidth, workingHeight)
    outputContext.drawImage(glyphCanvas, 0, 0)

  } else {
    // bs (字节范) flavor
    const rimWidth = effectiveOutlineWidth(
      renderControls.flavor,
      renderControls.envelope.outlineStrokeWidth,
    )

    const byteOutlineStops = gradientStops.map((color) =>
      darken(color, BYTE_OUTLINE_DARKEN),
    )
    const byteForegroundStops = gradientStops.map((color) =>
      lighten(color, BYTE_FOREGROUND_LIGHTEN),
    )

    // Layer 1: Deep outline — darkened gradient fill
    const deepCanvas = createSolidShapeCanvas(rimWidth * 2)
    const deepCtx = getContext(deepCanvas)
    const deepGradientExtent = gradientExtentFromCanvas(
      deepCanvas,
      renderControls.envelope.gradientAngle,
    )
    deepCtx.globalCompositeOperation = 'source-in'
    deepCtx.fillStyle = createGradient(
      deepCtx, renderControls.envelope.gradientAngle,
      byteOutlineStops, deepGradientExtent,
    )
    deepCtx.fillRect(0, 0, workingWidth, workingHeight)
    outputContext.drawImage(deepCanvas, 0, 0)

    // Layer 2: Glyph fill — foreground gradient
    const glyphCanvas = createRuntimeCanvas(workingWidth, workingHeight)
    const glyphCtx = getContext(glyphCanvas)
    glyphCtx.fillStyle = '#ffffff'
    drawFillOnly(glyphCtx)
    glyphCtx.globalCompositeOperation = 'source-in'
    glyphCtx.fillStyle = createGradient(
      glyphCtx, renderControls.envelope.gradientAngle,
      byteForegroundStops, deepGradientExtent,
    )
    glyphCtx.fillRect(0, 0, workingWidth, workingHeight)
    outputContext.drawImage(glyphCanvas, 0, 0)
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

  // 以「文字内容高度」（不含描边）为稳定参照来缩放
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
