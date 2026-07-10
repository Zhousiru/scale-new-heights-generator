import { createAntialiasedAlpha } from './mask'
import { createRuntimeCanvas } from './runtime'
import { getContext } from './canvas'
import type { BinaryMask } from './types'

/**
 * 将二值 mask 转换为白色+alpha 的 canvas（用于后续 destination-in 合成）。
 * 支持传入预计算的 DT 供 createAntialiasedAlpha 复用。
 */
export function maskToCanvas(
  mask: BinaryMask,
  softenRadius = 0,
  precomputedOutsideDT?: Float32Array,
  precomputedInsideDT?: Float32Array,
): OffscreenCanvas {
  const baseCanvas = createRuntimeCanvas(mask.width, mask.height)
  const baseContext = getContext(baseCanvas)
  const imageData = baseContext.createImageData(mask.width, mask.height)
  const alpha =
    softenRadius > 0
      ? createAntialiasedAlpha(mask, softenRadius, precomputedOutsideDT, precomputedInsideDT)
      : mask.data

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

// ---------------------------------------------------------------------------
// ③ 内存池复用: paintMask 的临时 canvas 可由调用方提供并重复使用，
//    避免每次调用都重新分配同尺寸 canvas。
// ---------------------------------------------------------------------------

/**
 * 创建可复用的 paintMask 临时缓冲区。在多次 paintMask 调用中传入同一个实例，
 * 避免重复创建/销毁同尺寸 OffscreenCanvas。
 */
export function createPaintBuffer(
  width: number,
  height: number,
): { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D } {
  const canvas = createRuntimeCanvas(width, height)
  const context = getContext(canvas)
  return { canvas, context }
}

export interface PaintBuffer {
  canvas: OffscreenCanvas
  context: OffscreenCanvasRenderingContext2D
}

/**
 * 通过 mask 合成绘制到目标 canvas。
 * @param buffer 可选复用缓冲区，避免每次调用分配新 canvas。
 */
export function paintMask(
  targetContext: OffscreenCanvasRenderingContext2D,
  maskCanvas: OffscreenCanvas,
  painter: (context: OffscreenCanvasRenderingContext2D) => void,
  opacity = 1,
  compositeOperation: GlobalCompositeOperation = 'source-over',
  buffer?: PaintBuffer,
): void {
  let temporaryContext: OffscreenCanvasRenderingContext2D
  let temporaryCanvas: OffscreenCanvas

  if (buffer) {
    // ③ 复用已有缓冲区：清空后重新绘制
    temporaryCanvas = buffer.canvas
    temporaryContext = buffer.context
    temporaryContext.globalCompositeOperation = 'source-over'
    temporaryContext.globalAlpha = 1
    temporaryContext.setTransform(1, 0, 0, 1, 0, 0)
    temporaryContext.filter = 'none'
    temporaryContext.clearRect(0, 0, temporaryCanvas.width, temporaryCanvas.height)
  } else {
    temporaryCanvas = createRuntimeCanvas(maskCanvas.width, maskCanvas.height)
    temporaryContext = getContext(temporaryCanvas)
  }

  painter(temporaryContext)
  temporaryContext.globalCompositeOperation = 'destination-in'
  temporaryContext.drawImage(maskCanvas, 0, 0)

  targetContext.save()
  targetContext.globalAlpha = opacity
  targetContext.globalCompositeOperation = compositeOperation
  targetContext.drawImage(temporaryCanvas, 0, 0)
  targetContext.restore()
}
