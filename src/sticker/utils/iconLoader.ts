// Iconify 图标是 SVG。`createImageBitmap` 无法在 Web Worker 内解码 SVG blob
//（Chromium 只在主线程栅格化 SVG），所以贴纸 worker 无法自行拉取图标。本模块
// 运行在主线程：它拉取一次 SVG（缓存为 Blob），并在每次渲染时栅格化出一张新的
// ImageBitmap，以便把位图转移进 worker 而不破坏缓存。
const ICON_RASTER_SIZE = 256

const iconBlobCache = new Map<string, Promise<Blob | null>>()

// 把形如 `mdi:rocket` 或 `mdi-rocket` 的 Iconify id 解析成拉取 URL。
// 单色图标以 color=#ffffff 请求，使其跟随白色文字填充；彩色图标忽略 color 参数、
// 保留自身配色。
export function iconIdToUrl(iconId: string): string | null {
  const trimmed = iconId.trim()
  if (trimmed.length === 0) return null

  const separator = trimmed.includes(':') ? ':' : '-'
  const splitAt = trimmed.indexOf(separator)
  if (splitAt <= 0 || splitAt >= trimmed.length - 1) return null

  const prefix = trimmed.slice(0, splitAt)
  const name = trimmed.slice(splitAt + 1)
  if (!/^[a-z0-9-]+$/i.test(prefix) || !/^[a-z0-9-]+$/i.test(name)) return null

  return (
    `https://api.iconify.design/${prefix}/${name}.svg` +
    `?height=${ICON_RASTER_SIZE}&color=%23ffffff`
  )
}

function loadIconBlob(iconId: string): Promise<Blob | null> {
  const cached = iconBlobCache.get(iconId)
  if (cached) return cached

  const promise = (async () => {
    const url = iconIdToUrl(iconId)
    if (!url) return null

    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const svg = await response.text()
      // Iconify 对未知图标会返回 "404" 文本。
      if (!svg.includes('<svg')) return null
      return new Blob([svg], { type: 'image/svg+xml' })
    } catch {
      return null
    }
  })()

  iconBlobCache.set(iconId, promise)
  return promise
}

export async function loadIconBitmap(iconId: string): Promise<ImageBitmap | null> {
  const blob = await loadIconBlob(iconId)
  if (!blob) return null

  // `createImageBitmap(svgBlob)` 在各引擎间表现不稳定，因此用可移植的方式栅格化
  // SVG：通过 <img> 解码，按图标尺寸（保持宽高比）绘制到 canvas 上，再把该 canvas
  // 快照为位图。
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()

    const naturalWidth = image.naturalWidth || ICON_RASTER_SIZE
    const naturalHeight = image.naturalHeight || ICON_RASTER_SIZE
    const scale = ICON_RASTER_SIZE / Math.max(naturalWidth, naturalHeight)
    const width = Math.max(1, Math.round(naturalWidth * scale))
    const height = Math.max(1, Math.round(naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)

    return await createImageBitmap(canvas)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
