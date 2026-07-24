export interface CopyImageResult {
  ok: boolean
  /** 复制失败时面向用户的中文提示，成功时为 undefined */
  message?: string
}

/** 右键手动复制的引导语，多个失败场景复用 */
const MANUAL_HINT = '请在预览图上右键选择「复制图片」。'

/**
 * 将图片写入剪贴板，并在失败时诊断具体原因。
 *
 * 剪贴板写入要求文档处于聚焦状态。点击按钮那一刻焦点必然存在，因此无需预检；
 * 只有当 `navigator.clipboard.write` 真正失败（如异步导出期间焦点被移出，抛
 * `NotAllowedError`）时，才回过头判断失焦、权限还是环境限制，给出可操作提示。
 */
export async function copyImageToClipboard(blob: Blob, mime: string): Promise<CopyImageResult> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return { ok: false, message: `当前浏览器不支持直接复制图片。${MANUAL_HINT}` }
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })])
    return { ok: true }
  } catch (error: unknown) {
    return { ok: false, message: describeClipboardError(error) }
  }
}

function describeClipboardError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      // NotAllowedError 最常见的原因就是写入瞬间文档失焦
      if (typeof document !== 'undefined' && !document.hasFocus()) {
        return '复制失败：页面已失去焦点。请点击页面后重试。'
      }
      return `复制失败：剪贴板权限被拒绝。请检查浏览器剪贴板权限，或${MANUAL_HINT}`
    }
    if (error.name === 'SecurityError') {
      return `复制失败：当前环境（如 iframe 或非 HTTPS）限制了剪贴板访问。${MANUAL_HINT}`
    }
  }
  const detail = error instanceof Error && error.message ? `（${error.message}）` : ''
  return `无法直接复制${detail}。${MANUAL_HINT}`
}
