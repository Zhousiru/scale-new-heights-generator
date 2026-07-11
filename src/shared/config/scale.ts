/** 抗锯齿倍率最小值 */
export const ANTIALIAS_SCALE_MIN = 1
/** 抗锯齿倍率最大值 */
export const ANTIALIAS_SCALE_MAX = 5
/** 默认抗锯齿倍率，兼顾边缘质量和渲染成本 */
export const DEFAULT_ANTIALIAS_SCALE = 1.5
/** 导出渲染倍率最小值 */
export const RENDER_SCALE_MIN = 1
/** 导出渲染倍率最大值 */
export const RENDER_SCALE_MAX = 3
/** 默认导出渲染倍率 */
export const DEFAULT_RENDER_SCALE = 1

export function normalizeAntialiasScale(value: unknown): number {
  return normalizeScale(
    value,
    ANTIALIAS_SCALE_MIN,
    ANTIALIAS_SCALE_MAX,
    DEFAULT_ANTIALIAS_SCALE,
  )
}

export function normalizeRenderScale(value: unknown): number {
  return normalizeScale(
    value,
    RENDER_SCALE_MIN,
    RENDER_SCALE_MAX,
    DEFAULT_RENDER_SCALE,
  )
}

function normalizeScale(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback
}
