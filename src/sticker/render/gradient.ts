import type { BinaryMask, GradientExtent } from './types'

export function createGradient(
  context: OffscreenCanvasRenderingContext2D,
  angleDeg: number,
  stops: string[],
  extent: GradientExtent,
): CanvasGradient {
  const angle = ((angleDeg - 90) * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const gradient = context.createLinearGradient(
    dx * extent.startProjection,
    dy * extent.startProjection,
    dx * extent.endProjection,
    dy * extent.endProjection,
  )

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

export function gradientExtentFromMask(mask: BinaryMask, angleDeg: number): GradientExtent {
  const angle = ((angleDeg - 90) * Math.PI) / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let startProjection = Number.POSITIVE_INFINITY
  let endProjection = Number.NEGATIVE_INFINITY

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] === 0) continue

      // 用像素中心做投影，stop 0/1 对应实际可见蒙版在该方向上的两端。
      const projection = (x + 0.5) * dx + (y + 0.5) * dy
      startProjection = Math.min(startProjection, projection)
      endProjection = Math.max(endProjection, projection)
    }
  }

  if (!Number.isFinite(startProjection) || endProjection <= startProjection) {
    const fallbackWidth = Math.max(1, mask.width)
    const fallbackHeight = Math.max(1, mask.height)
    const fallbackEnd = Math.abs(dx) * fallbackWidth + Math.abs(dy) * fallbackHeight
    return { startProjection: 0, endProjection: fallbackEnd }
  }

  return { startProjection, endProjection }
}
