import {
  normalizeRenderScale,
  type StickerControls,
} from '../config/defaults'
import { darken, lighten, resolveGradientStops } from '../utils/color'
import {
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
import {
  dilateCanvasOutwardRound,
  erodeCanvasInward,
  fillEnclosedRegionsCanvas,
  gradientExtentFromCanvas,
} from './paint'
import { createRuntimeCanvas } from './runtime'
import {
  configureTextContext,
  computeIconBox,
  buildGlyphTileCache,
  drawColorEmoji,
  drawEmojiGlyphs,
  drawGlyphsFromTiles,
  drawIcon,
  drawPlacedGlyphs,
  isTextPlacement,
} from './glyphs'
import {
  IDENTITY_GLYPH_TRANSFORM,
  type GradientExtent,
  type GlyphTransform,
  type OpaqueBounds,
  type RenderIcon,
  type RenderResult,
} from './types'

/** 导出时文字内容归一化到的目标高度，不含描边外扩 */
const EXPORT_TEXT_HEIGHT = 150
/** 默认导出图片最长边限制 */
const MAX_EXPORT_EDGE = 2048
/** 字节范描边颜色加深比例 */
const BYTE_OUTLINE_DARKEN = 0.4
/** 字节范前景颜色提亮比例 */
const BYTE_FOREGROUND_LIGHTEN = 0.4

export interface RenderStickerOptions {
  /** 导出像素倍率，浏览器 UI 默认 1；Node/机器人可用 2~3 生成更高清图片 */
  outputScale?: number
  /** 内部超采样倍率，默认跟随 controls，未配置时为 1.5，用于平滑斜线和斜切边缘 */
  antialiasScale?: number
  /** 限制导出图片最长边，避免机器人上传过大图片 */
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

  // ---------- Glyph Tile Cache: pre-render each unique glyph once ----------
  // This is the key web optimization: avoids repeated strokeText/fillText calls.
  // 300 unique chars × 1 strokeText each, then N×drawImage (texture blit) per layer.
  const primaryStrokeWidth = renderControls.envelope.outlineStrokeWidth * 2
  const { strokeTiles, fillTiles } = buildGlyphTileCache(layout, primaryStrokeWidth)

  // ---------- Helper: draw non-emoji glyphs + icon with stroke and fill ----------
  const drawStrokeAndFill = (
    context: OffscreenCanvasRenderingContext2D,
    lineWidth: number,
    ox = originX,
    oy = originY,
  ) => {
    // Use tile cache for the primary stroke width; fall back to direct draw for others
    if (lineWidth === primaryStrokeWidth) {
      drawGlyphsFromTiles(context, layout, strokeTiles, ox, oy)
    } else {
      context.lineWidth = lineWidth
      context.lineJoin = 'round'
      context.lineCap = 'round'
      context.miterLimit = 2
      configureTextContext(context, renderControls.fontSize, renderControls.flavor)
      drawPlacedGlyphs(context, layout, ox, oy, (ctx, grapheme) => {
        ctx.strokeText(grapheme, 0, 0)
        ctx.fillText(grapheme, 0, 0)
      }, isTextPlacement)
      // emoji for non-cached lineWidths still needs shape contribution
      if (layout.placements.some((p) => isEmojiGrapheme(p.grapheme))) {
        drawEmojiGlyphs(context, layout, renderControls.fontSize, renderControls.flavor, ox, oy)
      }
    }
    // draw icon shape with the same outward expansion as text stroke
    if (iconBitmap && iconBox) {
      drawIconShape(context, lineWidth, ox, oy)
    }
  }

  // Helper: draw text glyphs fill-only (uses cached fill tiles)
  const drawFillOnly = (
    context: OffscreenCanvasRenderingContext2D,
    ox = originX,
    oy = originY,
  ) => {
    drawGlyphsFromTiles(context, layout, fillTiles, ox, oy)
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

  const drawIconShape = (
    context: OffscreenCanvasRenderingContext2D,
    lineWidth: number,
    ox = originX,
    oy = originY,
  ) => {
    if (!iconBitmap || !iconBox) return
    if (lineWidth <= 0) {
      drawIcon(context, iconBitmap, iconBox, ox, oy, iconGlyphTransform)
      return
    }

    const iconCanvas = createRuntimeCanvas(workingWidth, workingHeight)
    drawIcon(
      getContext(iconCanvas),
      iconBitmap,
      iconBox,
      ox,
      oy,
      iconGlyphTransform,
    )
    dilateCanvasOutwardRound(iconCanvas, lineWidth / 2)
    context.drawImage(iconCanvas, 0, 0)
  }

  if (renderControls.flavor === 'snh') {
    // 白色字形置于彩色包体内并带较深的边缘轮廓，另在字形下方叠加 multiply 混合
    // 阴影，使白字读起来像是浮在彩色主体之上（匹配源表情包）。
    const bandWidth = renderControls.envelope.outlineStrokeWidth

    // Build the solid white envelope shape once — reused by all layers
    const envelopeWhiteCanvas = createSolidShapeCanvas(bandWidth * 2)
    const envelopeGradientExtent = gradientExtentFromCanvas(
      envelopeWhiteCanvas,
      renderControls.envelope.gradientAngle,
    )

    // Layer 1: Envelope — dilated outline filled with gradient
    const envelopeCanvas = cloneCanvas(envelopeWhiteCanvas)
    fillSourceInGradient(
      envelopeCanvas,
      renderControls.envelope.gradientAngle,
      gradientStops,
      envelopeGradientExtent,
    )
    compositeCanvas(outputContext, envelopeCanvas)

    // Layer 2: Edge band — darkened ring between outer and inner boundary
    if (renderControls.envelope.edgeWidth > 0 && renderControls.envelope.edgeOpacity > 0) {
      const edgeCanvas = cloneCanvas(envelopeWhiteCanvas)
      const edgeCtx = getContext(edgeCanvas)
      // Erode inward by edgeWidth to get the inner boundary
      const erodedCanvas = cloneCanvas(envelopeWhiteCanvas)
      erodeCanvasInward(erodedCanvas, renderControls.envelope.edgeWidth)
      // edge = envelope - eroded (subtract inner from outer)
      edgeCtx.globalCompositeOperation = 'destination-out'
      edgeCtx.drawImage(erodedCanvas, 0, 0)
      // Color the edge ring with darkened gradient
      fillSourceInGradient(
        edgeCanvas,
        renderControls.envelope.gradientAngle,
        gradientStops.map((color) => darken(color, 0.45)),
        envelopeGradientExtent,
      )
      // Composite edge onto output with multiply blend
      compositeCanvas(outputContext, edgeCanvas, renderControls.envelope.edgeOpacity, 'multiply')
    }

    // Layer 3: Inner shadow
    if (renderControls.shadow.opacity > 0) {
      const shadowCanvas = createRuntimeCanvas(workingWidth, workingHeight)
      const shadowCtx = getContext(shadowCanvas)
      // Draw blurred shadow content first (using cached fill tiles)
      shadowCtx.fillStyle = renderControls.shadow.color
      shadowCtx.filter = `blur(${renderControls.shadow.blur}px)`
      drawGlyphsFromTiles(
        shadowCtx, layout, fillTiles,
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
      shadowCtx.filter = 'none'
      fillSourceInColor(shadowCanvas, renderControls.shadow.color)
      // Clip shadow to the envelope shape (reuse envelopeWhiteCanvas)
      clipCanvasToAlpha(shadowCanvas, envelopeWhiteCanvas)
      // Composite shadow onto output
      compositeCanvas(outputContext, shadowCanvas, renderControls.shadow.opacity, 'multiply')
    }

    // Layer 4: White glyph fill on top
    const glyphCanvas = createRuntimeCanvas(workingWidth, workingHeight)
    const glyphCtx = getContext(glyphCanvas)
    glyphCtx.fillStyle = '#ffffff'
    drawFillOnly(glyphCtx)
    fillSourceInColor(glyphCanvas, '#ffffff')
    compositeCanvas(outputContext, glyphCanvas)

  } else {
    // 彩色字形直接由加深的同色系外层带包裹——没有白色描边。外扩部分就是加深后的颜色本身。
    const rimWidth = renderControls.envelope.outlineStrokeWidth

    const byteOutlineStops = gradientStops.map((color) =>
      darken(color, BYTE_OUTLINE_DARKEN),
    )
    const byteForegroundStops = gradientStops.map((color) =>
      lighten(color, BYTE_FOREGROUND_LIGHTEN),
    )

    // Layer 1: Deep outline — darkened gradient fill
    const deepCanvas = createSolidShapeCanvas(rimWidth * 2)
    const deepGradientExtent = gradientExtentFromCanvas(
      deepCanvas,
      renderControls.envelope.gradientAngle,
    )
    fillSourceInGradient(
      deepCanvas,
      renderControls.envelope.gradientAngle,
      byteOutlineStops,
      deepGradientExtent,
    )
    compositeCanvas(outputContext, deepCanvas)

    // Layer 2: Glyph fill — foreground gradient
    const glyphCanvas = createRuntimeCanvas(workingWidth, workingHeight)
    const glyphCtx = getContext(glyphCanvas)
    glyphCtx.fillStyle = '#ffffff'
    drawFillOnly(glyphCtx)
    fillSourceInGradient(
      glyphCanvas,
      renderControls.envelope.gradientAngle,
      byteForegroundStops,
      deepGradientExtent,
    )
    compositeCanvas(outputContext, glyphCanvas)
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

function cloneCanvas(source: OffscreenCanvas): OffscreenCanvas {
  const canvas = createRuntimeCanvas(source.width, source.height)
  getContext(canvas).drawImage(source, 0, 0)
  return canvas
}

function fillSourceInGradient(
  canvas: OffscreenCanvas,
  angle: number,
  stops: string[],
  extent: GradientExtent,
): void {
  const context = getContext(canvas)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = createGradient(context, angle, stops, extent)
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function fillSourceInColor(canvas: OffscreenCanvas, color: string): void {
  const context = getContext(canvas)
  context.globalCompositeOperation = 'source-in'
  context.fillStyle = color
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function clipCanvasToAlpha(canvas: OffscreenCanvas, mask: OffscreenCanvas): void {
  const context = getContext(canvas)
  context.globalCompositeOperation = 'destination-in'
  context.drawImage(mask, 0, 0)
}

function compositeCanvas(
  target: OffscreenCanvasRenderingContext2D,
  source: OffscreenCanvas,
  opacity = 1,
  operation: GlobalCompositeOperation = 'source-over',
): void {
  target.save()
  target.globalAlpha = opacity
  target.globalCompositeOperation = operation
  target.drawImage(source, 0, 0)
  target.restore()
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
