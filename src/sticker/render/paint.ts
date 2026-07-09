import { createCanvas, getContext } from './canvas'
import { createAntialiasedAlpha } from './mask'
import type { BinaryMask } from './types'

export function maskToCanvas(mask: BinaryMask, softenRadius = 0): OffscreenCanvas {
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

export function paintMask(
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
