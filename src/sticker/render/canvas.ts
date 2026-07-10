import { findOpaqueBounds } from './mask'
import { createRuntimeCanvas } from './runtime'
import type { OpaqueBounds } from './types'
import { getContext } from '../../shared/render/canvas'

export { getContext }

export function extractAlphaChannel(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const alpha = new Uint8ClampedArray(rgba.length / 4)

  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = rgba[index * 4 + 3]
  }

  return alpha
}

export function cropResizePadCanvas(
  sourceCanvas: OffscreenCanvas,
  scale: number,
  maxEdge: number,
  paddingX: number,
  paddingY: number,
  minimumBounds?: OpaqueBounds,
): OffscreenCanvas {
  const sourceContext = getContext(sourceCanvas)
  const imageData = sourceContext.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  )
  const opaqueBounds = findOpaqueBounds(
    extractAlphaChannel(imageData.data),
    sourceCanvas.width,
    sourceCanvas.height,
  )

  const bounds = mergeOpaqueBounds(
    opaqueBounds,
    minimumBounds,
    sourceCanvas.width,
    sourceCanvas.height,
  )
  if (!bounds) {
    throw new Error('Rendered canvas is empty.')
  }

  const cropX = bounds.left
  const cropY = bounds.top
  const cropWidth = bounds.right - bounds.left + 1
  const cropHeight = bounds.bottom - bounds.top + 1
  const scaledWidth = Math.max(1, Math.round(cropWidth * scale))
  const scaledHeight = Math.max(1, Math.round(cropHeight * scale))
  const longestEdge = Math.max(scaledWidth, scaledHeight)
  const clampScale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
  const outputWidth = Math.max(1, Math.round(scaledWidth * clampScale))
  const outputHeight = Math.max(1, Math.round(scaledHeight * clampScale))
  const x = Math.max(0, Math.round(paddingX))
  const y = Math.max(0, Math.round(paddingY))
  const canvas = createRuntimeCanvas(outputWidth + x * 2, outputHeight + y * 2)
  const context = getContext(canvas)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    sourceCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    x,
    y,
    outputWidth,
    outputHeight,
  )
  return canvas
}

function mergeOpaqueBounds(
  opaqueBounds: OpaqueBounds | null,
  minimumBounds: OpaqueBounds | undefined,
  width: number,
  height: number,
): OpaqueBounds | null {
  if (!minimumBounds) return opaqueBounds

  const clampedMinimum = {
    left: Math.max(0, Math.min(width - 1, minimumBounds.left)),
    top: Math.max(0, Math.min(height - 1, minimumBounds.top)),
    right: Math.max(0, Math.min(width - 1, minimumBounds.right)),
    bottom: Math.max(0, Math.min(height - 1, minimumBounds.bottom)),
  }
  if (
    clampedMinimum.right < clampedMinimum.left ||
    clampedMinimum.bottom < clampedMinimum.top
  ) {
    return opaqueBounds
  }
  if (!opaqueBounds) return clampedMinimum

  return {
    left: Math.min(opaqueBounds.left, clampedMinimum.left),
    top: Math.min(opaqueBounds.top, clampedMinimum.top),
    right: Math.max(opaqueBounds.right, clampedMinimum.right),
    bottom: Math.max(opaqueBounds.bottom, clampedMinimum.bottom),
  }
}
