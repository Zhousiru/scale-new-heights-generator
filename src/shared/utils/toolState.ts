const KEYS = {
  sticker: 'scale-new-heights:sticker-search',
  avatar: 'scale-new-heights:avatar-search',
} as const

export type ToolKind = keyof typeof KEYS

export function saveToolSearch(tool: ToolKind, search: Record<string, string>): void {
  try {
    globalThis.localStorage?.setItem(KEYS[tool], JSON.stringify(search))
  } catch {
    // Ignore storage failures; URL state remains the source of truth.
  }
}

export function loadToolSearch(tool: ToolKind): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEYS[tool])
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}

    const search: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') search[key] = value
    }
    return search
  } catch {
    return {}
  }
}

export function searchRecordKey(search: Record<string, string>): string {
  return Object.entries(search)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
