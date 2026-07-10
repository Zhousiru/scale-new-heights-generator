export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type TextRenderInput<T> = DeepPartial<T> | string

export function normalizeTextRenderInput<T>(
  input: TextRenderInput<T>,
  normalize: (value: unknown) => T,
): T {
  return normalize(typeof input === 'string' ? { text: input } : input)
}
