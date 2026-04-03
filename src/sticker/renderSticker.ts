import type { StickerControls } from './defaults'

const FONT_FAMILY = 'DouyinSansBold'
const FONT_WEIGHT = '900'
const FONT_STYLE = 'normal'
const FONT_SAMPLE_TEXT = '勇攀高峰测试Aa0123456789'
const SAFETY_PADDING = 20
const EXPORT_TARGET_HEIGHT = 150
const MAX_EXPORT_EDGE = 2048
const ENVELOPE_ANTIALIAS = 1.1
const OUTLINE_ANTIALIAS = 0.9
const ALPHA_THRESHOLD = 16
const DISTANCE_INF = 1e15

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
}

export interface StickerLayout {
  placements: GlyphPlacement[]
  bounds: Bounds
  skewTangent: number
  letterSpacing: number
  fontSize: number
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

let fontLoadPromise: Promise<void> | null = null
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
    glyphSkewDeg: number
    alternatingOffset: number
    letterSpacing: number
    measureGlyph: (grapheme: string, fontSize: number) => GlyphMeasurement
  },
): StickerLayout {
  const graphemes = splitGraphemes(text)
  const letterSpacing = options.letterSpacing

  const placements: GlyphPlacement[] = []
  let cursorX = 0
  let bounds: Bounds | null = null

  graphemes.forEach((grapheme, index) => {
    const measurement = options.measureGlyph(grapheme, options.fontSize)
    const skewedBounds = measureSkewedGlyphBounds(
      measurement,
      options.glyphSkewDeg,
    )
    const baselineY = getAlternatingOffset(index, options.alternatingOffset)
    const placementBounds = offsetBounds(skewedBounds, cursorX, baselineY)

    placements.push({
      grapheme,
      x: cursorX,
      baselineY,
      advanceWidth: measurement.advanceWidth,
      bounds: placementBounds,
    })

    bounds = bounds ? mergeBounds(bounds, placementBounds) : placementBounds
    cursorX += measurement.advanceWidth + letterSpacing
  })

  return {
    placements,
    bounds: bounds ?? emptyBounds(),
    skewTangent: Math.tan((options.glyphSkewDeg * Math.PI) / 180),
    letterSpacing,
    fontSize: options.fontSize,
  }
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

export function expandMask(mask: BinaryMask, radius = 1): BinaryMask {
  return dilateMaskRound(mask, radius)
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

export function closeMaskRound(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  const dilated = dilateMaskRound(mask, radius)
  const erodedComplement = dilateMaskRound(invertMask(dilated), radius)
  return invertMask(erodedComplement)
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

export async function ensureStickerFontLoaded(): Promise<void> {
  if (typeof FontFace === 'undefined') return

  if (!fontLoadPromise) {
    const fonts: FontFaceSet | undefined =
      typeof document !== 'undefined'
        ? document.fonts
        : (globalThis as unknown as { fonts?: FontFaceSet }).fonts

    if (!fonts) return

    const fontSpec = `${FONT_STYLE} ${FONT_WEIGHT} 16px "${FONT_FAMILY}"`
    const font = new FontFace(
      FONT_FAMILY,
      `url(${import.meta.env.BASE_URL}DouyinSansBold.woff2) format("woff2")`,
      { style: FONT_STYLE, weight: FONT_WEIGHT },
    )

    fontLoadPromise = font.load().then((loaded) => {
      fonts.add(loaded)
      return fonts.load(fontSpec, FONT_SAMPLE_TEXT).then(() => undefined)
    }).catch((error: unknown) => {
      fontLoadPromise = null
      throw error
    })
  }

  await fontLoadPromise
}

export async function renderSticker(
  controls: StickerControls,
): Promise<RenderResult> {
  const trimmedText = controls.text.trim()
  if (trimmedText.length === 0) {
    throw new Error('Text is required for sticker export.')
  }

  await ensureStickerFontLoaded()

  const layout = createStickerLayout(trimmedText, {
    fontSize: controls.fontSize,
    glyphSkewDeg: controls.glyphSkewDeg,
    letterSpacing: controls.letterSpacing,
    alternatingOffset: controls.alternatingOffset,
    measureGlyph: measureGlyphWithCanvas,
  })

  const padding = calculateWorkingPadding(controls)
  const workingWidth = Math.max(
    1,
    Math.ceil(layout.bounds.maxX - layout.bounds.minX + padding * 2),
  )
  const workingHeight = Math.max(
    1,
    Math.ceil(layout.bounds.maxY - layout.bounds.minY + padding * 2),
  )
  const originX = padding - layout.bounds.minX
  const originY = padding - layout.bounds.minY

  const sourceMaskCanvas = createCanvas(workingWidth, workingHeight)
  const sourceMaskContext = getContext(sourceMaskCanvas)
  resetAndPrepareTextContext(sourceMaskContext, controls.fontSize)
  sourceMaskContext.fillStyle = '#ffffff'
  sourceMaskContext.strokeStyle = '#ffffff'
  sourceMaskContext.lineJoin = 'round'
  sourceMaskContext.lineCap = 'round'
  sourceMaskContext.lineWidth = controls.envelope.outlineStrokeWidth * 2
  drawGlyphMask(
    sourceMaskContext,
    layout,
    originX,
    originY,
    controls.envelope.outlineStrokeWidth > 0,
  )

  const sourceMask = thresholdAlphaMask(
    extractAlphaChannel(
      sourceMaskContext.getImageData(0, 0, workingWidth, workingHeight).data,
    ),
    workingWidth,
    workingHeight,
    ALPHA_THRESHOLD,
  )
  const envelopeMask = buildEnvelopeMask(sourceMask, controls.envelope.spread)
  const outlineMask = subtractMask(
    envelopeMask,
    erodeMaskRound(envelopeMask, controls.envelope.edgeWidth),
  )
  const envelopeMaskCanvas = maskToCanvas(envelopeMask, ENVELOPE_ANTIALIAS)
  const outlineMaskCanvas = maskToCanvas(outlineMask, OUTLINE_ANTIALIAS)

  const outputCanvas = createCanvas(workingWidth, workingHeight)
  const outputContext = getContext(outputCanvas)

  paintMask(outputContext, envelopeMaskCanvas, (context) => {
      context.fillStyle = createGradient(
        context,
        workingWidth,
        workingHeight,
        controls.envelope.gradientAngle,
        controls.envelope.gradientStart,
        controls.envelope.gradientEnd,
      )
      context.fillRect(0, 0, workingWidth, workingHeight)
    },
  )

  paintMask(
    outputContext,
    outlineMaskCanvas,
    (context) => {
      context.fillStyle = createGradient(
        context,
        workingWidth,
        workingHeight,
        controls.envelope.gradientAngle,
        darkenHexColor(controls.envelope.gradientStart, 0.45),
        darkenHexColor(controls.envelope.gradientEnd, 0.45),
      )
      context.fillRect(0, 0, workingWidth, workingHeight)
    },
    controls.envelope.edgeOpacity,
    'multiply',
  )

  drawTextShadow(outputContext, layout, originX, originY, controls)

  configureTextContext(outputContext, controls.fontSize)
  outputContext.fillStyle = '#ffffff'
  drawFilledGlyphs(outputContext, layout, originX, originY)

  const croppedCanvas = cropCanvas(outputCanvas, SAFETY_PADDING)
  const exportCanvas = resizeCanvasToHeight(
    croppedCanvas,
    EXPORT_TARGET_HEIGHT,
    MAX_EXPORT_EDGE,
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
      controls.envelope.spread * 2.5 +
      controls.envelope.outlineStrokeWidth * 2 +
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
): void {
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  configureTextContext(context, fontSize)
}

function configureTextContext(
  context: OffscreenCanvasRenderingContext2D,
  fontSize: number,
): void {
  context.font =
    `${FONT_STYLE} ${FONT_WEIGHT} ${fontSize}px ` +
    `"${FONT_FAMILY}", "PingFang SC", sans-serif`
  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
}

function drawFilledGlyphs(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
): void {
  drawPlacedGlyphs(context, layout, originX, originY, (current, grapheme) => {
    current.fillText(grapheme, 0, 0)
  })
}

function drawGlyphMask(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
  stroke: boolean,
): void {
  drawPlacedGlyphs(context, layout, originX, originY, (current, grapheme) => {
    current.fillText(grapheme, 0, 0)
    if (stroke) {
      current.strokeText(grapheme, 0, 0)
    }
  })
}

function drawPlacedGlyphs(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
  painter: (context: OffscreenCanvasRenderingContext2D, grapheme: string) => void,
): void {
  for (const placement of layout.placements) {
    context.save()
    context.translate(originX + placement.x, originY + placement.baselineY)
    context.transform(1, layout.skewTangent, 0, 1, 0, 0)
    painter(context, placement.grapheme)
    context.restore()
  }
}

function drawTextShadow(
  context: OffscreenCanvasRenderingContext2D,
  layout: StickerLayout,
  originX: number,
  originY: number,
  controls: StickerControls,
): void {
  context.save()
  context.globalAlpha = controls.shadow.opacity
  context.globalCompositeOperation = 'multiply'
  context.fillStyle = controls.shadow.color
  context.filter = `blur(${controls.shadow.blur}px)`
  configureTextContext(context, controls.fontSize)
  drawFilledGlyphs(
    context,
    layout,
    originX + controls.shadow.offsetX,
    originY + controls.shadow.offsetY,
  )
  context.restore()
}

function buildEnvelopeMask(sourceMask: BinaryMask, spread: number): BinaryMask {
  return closeMaskRound(sourceMask, spread)
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
  startColor: string,
  endColor: string,
): CanvasGradient {
  const angle = (angleDeg * Math.PI) / 180
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

  gradient.addColorStop(0, startColor)
  gradient.addColorStop(1, endColor)
  return gradient
}

function darkenHexColor(color: string, amount: number): string {
  const normalized = color.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return color
  }

  const channels = normalized.match(/.{2}/g)
  if (!channels) {
    return color
  }

  const next = channels.map((channel) =>
    Math.max(
      0,
      Math.min(255, Math.round(parseInt(channel, 16) * (1 - amount))),
    ),
  )

  return `rgb(${next[0]}, ${next[1]}, ${next[2]})`
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

function cropCanvas(
  sourceCanvas: OffscreenCanvas,
  padding: number,
): OffscreenCanvas {
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

  const left = Math.max(0, bounds.left - padding)
  const top = Math.max(0, bounds.top - padding)
  const right = Math.min(sourceCanvas.width - 1, bounds.right + padding)
  const bottom = Math.min(sourceCanvas.height - 1, bounds.bottom + padding)
  const width = right - left + 1
  const height = bottom - top + 1

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

function resizeCanvasToHeight(
  sourceCanvas: OffscreenCanvas,
  targetHeight: number,
  maxEdge: number,
): OffscreenCanvas {
  const heightScale = targetHeight / sourceCanvas.height
  const targetWidth = Math.max(1, Math.round(sourceCanvas.width * heightScale))
  const longestEdge = Math.max(targetWidth, targetHeight)
  const outputScale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
  const outputWidth = Math.max(1, Math.round(targetWidth * outputScale))
  const outputHeight = Math.max(1, Math.round(targetHeight * outputScale))
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
): GlyphMeasurement {
  const canvas = measurementCanvas ?? createCanvas(1, 1)
  measurementCanvas = canvas
  const context = getContext(canvas)
  context.font =
    `${FONT_STYLE} ${FONT_WEIGHT} ${fontSize}px ` +
    `"${FONT_FAMILY}", "PingFang SC", sans-serif`
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
