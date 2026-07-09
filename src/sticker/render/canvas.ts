import { findOpaqueBounds } from './mask'
import { createRuntimeCanvas, runtimeCanvasToPngBytes } from './runtime'

export function extractAlphaChannel(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(rgba.length / 4)

  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rgba[index * 4 + 3]
  }

  return alpha
}

export function cropCanvas(sourceCanvas: OffscreenCanvas): OffscreenCanvas {
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
export function padCanvas(
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

export function resizeCanvasByScale(
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

export function canvasToPngBlob(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/png' })
}

export function canvasToPngBytes(canvas: OffscreenCanvas): Promise<Uint8Array> {
  return runtimeCanvasToPngBytes(canvas)
}

export function createCanvas(width: number, height: number): OffscreenCanvas {
  return createRuntimeCanvas(width, height)
}

export function getContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    throw new Error('2D canvas context is unavailable.')
  }

  return context
}
