import type { StickerFlavor } from '../config/defaults'
import { fontSpec, usesFeatureFont } from './font'
import { isEmojiGrapheme } from './layout'
import { createCanvas, getContext } from './canvas'
import type {
  GlyphPlacement,
  GlyphTransform,
  IconBox,
  StickerLayout,
} from './types'

const EMOJI_CORNER_CUT_RATIO = 0.02

export function resetAndPrepareTextContext(
  context: OffscreenCanvasRenderingContext2D,
  fontSize: number,
  flavor: StickerFlavor,
): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  configureTextContext(context, fontSize, flavor)
}

export function configureTextContext(
  context: OffscreenCanvasRenderingContext2D,
  fontSize: number,
  flavor: StickerFlavor,
): void {
  context.font = fontSpec(flavor, fontSize)
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
}

export function drawFilledGlyphs(
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
export function isTextPlacement(placement: GlyphPlacement): boolean {
  return !isEmojiGrapheme(placement.grapheme)
}

export function drawEmojiGlyphs(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  fontSize: number,
  flavor: StickerFlavor,
  originX: number,
  originY: number,
): void {
  const emojiPlacements = layout.placements.filter(
    (placement) => !isTextPlacement(placement),
  )
  if (emojiPlacements.length === 0) return

  for (const placement of emojiPlacements) {
    // Apple Color Emoji 在右上/左下偶有孤立像素。逐字符隔离绘制后再裁角，
    // 避免一次性绘制全部 emoji 时，某个字符的裁剪矩形擦到相邻字符。
    drawSingleEmojiGlyph(context, layout, placement, fontSize, flavor, originX, originY)
  }
}

// 以 Emoji 原生彩色直接绘制到目标画布（不经蒙版重着色，从而保留其真实配色）。
export function drawColorEmoji(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  fontSize: number,
  flavor: StickerFlavor,
  originX: number,
  originY: number,
): void {
  drawEmojiGlyphs(context, layout, fontSize, flavor, originX, originY)
}

function clearEmojiCornerArtifacts(
  context: OffscreenCanvasRenderingContext2D,
  placement: GlyphPlacement,
  originX: number,
  originY: number,
): void {
  const left = originX + placement.bounds.minX
  const top = originY + placement.bounds.minY
  const width = placement.bounds.maxX - placement.bounds.minX
  const height = placement.bounds.maxY - placement.bounds.minY
  const cutSize = Math.max(1, Math.round(Math.min(width, height) * EMOJI_CORNER_CUT_RATIO))

  context.clearRect(left + width - cutSize, top, cutSize, cutSize)
  context.clearRect(left, top + height - cutSize, cutSize, cutSize)
}

function drawSingleEmojiGlyph(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  placement: GlyphPlacement,
  fontSize: number,
  flavor: StickerFlavor,
  originX: number,
  originY: number,
): void {
  const left = Math.floor(originX + placement.bounds.minX)
  const top = Math.floor(originY + placement.bounds.minY)
  const right = Math.ceil(originX + placement.bounds.maxX)
  const bottom = Math.ceil(originY + placement.bounds.maxY)
  const emojiCanvas = createCanvas(right - left, bottom - top)
  const emojiContext = getContext(emojiCanvas)

  resetAndPrepareTextContext(emojiContext, fontSize, flavor)
  drawPlacedGlyphs(
    emojiContext,
    layout,
    originX - left,
    originY - top,
    (current, grapheme) => {
      current.fillText(grapheme, 0, 0)
    },
    (currentPlacement) => currentPlacement === placement,
  )
  clearEmojiCornerArtifacts(emojiContext, placement, originX - left, originY - top)
  context.drawImage(emojiCanvas, left, top)
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
  const verticalSkewTangent = Math.tan((skewDeg[1] * Math.PI) / 180)

  for (const placement of layout.placements) {
    if (filter && !filter(placement)) continue
    context.save()
    context.font = fontSpec(
      layout.flavor,
      layout.fontSize,
      placement.grapheme,
      layout.chineseDominant,
    )
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
      const horizontalSkewDeg = usesFeatureFont(
        layout.flavor,
        placement.grapheme,
        layout.chineseDominant,
      )
        ? skewDeg[0]
        : 0
      const horizontalSkewTangent = Math.tan(
        (horizontalSkewDeg * Math.PI) / 180,
      )
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

// 将图标缩放到第一行文字的字高，并放在字形左侧，在该行内垂直居中。
export function computeIconBox(
  iconBitmap: ImageBitmap,
  layout: StickerLayout,
  fontSize: number,
  transform: GlyphTransform,
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
  const box = {
    minX,
    minY: centerY - size / 2,
    maxX,
    maxY: centerY + size / 2,
    drawWidth,
    drawHeight: size,
  }

  return transformIconBox(box, transform)
}

export function drawIcon(
  context: OffscreenCanvasRenderingContext2D,
  iconBitmap: ImageBitmap,
  box: IconBox,
  originX: number,
  originY: number,
  transform: GlyphTransform,
): void {
  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  const centerX = (box.minX + box.maxX) / 2
  const centerY = (box.minY + box.maxY) / 2
  context.translate(originX + centerX, originY + centerY)
  applyGlyphTransform(context, transform)
  context.drawImage(
    iconBitmap,
    -box.drawWidth / 2,
    -box.drawHeight / 2,
    box.drawWidth,
    box.drawHeight,
  )
  context.restore()
}

function transformIconBox(box: IconBox, transform: GlyphTransform): IconBox {
  const centerX = (box.minX + box.maxX) / 2
  const centerY = (box.minY + box.maxY) / 2
  const corners = [
    [box.minX - centerX, box.minY - centerY],
    [box.maxX - centerX, box.minY - centerY],
    [box.minX - centerX, box.maxY - centerY],
    [box.maxX - centerX, box.maxY - centerY],
  ] as const

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const [x, y] of corners) {
    const point = transformGlyphPoint(x, y, transform)
    minX = Math.min(minX, centerX + point.x)
    minY = Math.min(minY, centerY + point.y)
    maxX = Math.max(maxX, centerX + point.x)
    maxY = Math.max(maxY, centerY + point.y)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    drawWidth: box.drawWidth,
    drawHeight: box.drawHeight,
  }
}

function applyGlyphTransform(
  context: OffscreenCanvasRenderingContext2D,
  transform: GlyphTransform,
): void {
  const { scale, rotationDeg, skewDeg } = transform
  const [scaleX, scaleY] = scale
  const rotationRad = (rotationDeg * Math.PI) / 180
  const horizontalSkewTangent = Math.tan((skewDeg[0] * Math.PI) / 180)
  const verticalSkewTangent = Math.tan((skewDeg[1] * Math.PI) / 180)

  if (scaleX !== 1 || scaleY !== 1) context.scale(scaleX, scaleY)
  if (rotationRad !== 0) context.rotate(-rotationRad)
  if (horizontalSkewTangent !== 0) {
    context.transform(1, 0, horizontalSkewTangent, 1, 0, 0)
  }
  if (verticalSkewTangent !== 0) {
    context.transform(1, verticalSkewTangent, 0, 1, 0, 0)
  }
}

function transformGlyphPoint(
  x: number,
  y: number,
  transform: GlyphTransform,
): { x: number; y: number } {
  const [scaleX, scaleY] = transform.scale
  let nextX = x * scaleX
  let nextY = y * scaleY

  const rotationRad = (-transform.rotationDeg * Math.PI) / 180
  if (rotationRad !== 0) {
    const cos = Math.cos(rotationRad)
    const sin = Math.sin(rotationRad)
    const rotatedX = nextX * cos - nextY * sin
    const rotatedY = nextX * sin + nextY * cos
    nextX = rotatedX
    nextY = rotatedY
  }

  const horizontalSkewTangent = Math.tan((transform.skewDeg[0] * Math.PI) / 180)
  if (horizontalSkewTangent !== 0) {
    nextX += horizontalSkewTangent * nextY
  }

  const verticalSkewTangent = Math.tan((transform.skewDeg[1] * Math.PI) / 180)
  if (verticalSkewTangent !== 0) {
    nextY += verticalSkewTangent * nextX
  }

  return { x: nextX, y: nextY }
}
