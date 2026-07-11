const TOOL = {
  sticker: {
    path: '/',
    storageKey: 'scale-new-heights:sticker-search',
  },
  avatar: {
    path: '/avatar',
    storageKey: 'scale-new-heights:avatar-search',
  },
} as const

export type Tool = keyof typeof TOOL

export function toolUrl(tool: Tool, search: Record<string, string>): string {
  const query = new URLSearchParams(search).toString()
  return `${location.origin}${location.pathname}#${TOOL[tool].path}${query ? `?${query}` : ''}`
}

export function saveToolSearch(tool: Tool, search: Record<string, string>): void {
  try {
    globalThis.localStorage?.setItem(TOOL[tool].storageKey, JSON.stringify(search))
  } catch {
    // URL state remains the source of truth.
  }
}

export function loadToolSearch(tool: Tool): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(TOOL[tool].storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null) return {}

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
