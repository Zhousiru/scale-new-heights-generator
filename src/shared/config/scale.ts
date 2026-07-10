export const ANTIALIAS_SCALE_MIN = 1
export const ANTIALIAS_SCALE_MAX = 5
export const DEFAULT_ANTIALIAS_SCALE = 1.5
export const RENDER_SCALE_MIN = 1
export const RENDER_SCALE_MAX = 3
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
