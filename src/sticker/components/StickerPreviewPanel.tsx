import { useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import type { CopiedTarget } from '../hooks/useStickerEditor'
import type { PreviewResult } from '../worker/stickerWorker'

const IN_IFRAME = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

interface StickerPreviewPanelProps {
  preview: PreviewResult | null
  previewError: string | null
  isRendering: boolean
  isExporting: boolean
  copied: CopiedTarget | null
  hasText: boolean
  shareUrl: string
  onCopyImage: () => void
  onExport: () => void
  onCopyLink: () => void
}

export function StickerPreviewPanel({
  preview,
  previewError,
  isRendering,
  isExporting,
  copied,
  hasText,
  shareUrl,
  onCopyImage,
  onExport,
  onCopyLink,
}: StickerPreviewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = preview.width
    canvas.height = preview.height
    // 只设置 CSS 宽度；高度保持 `auto`，避免预览缩放时被压扁。
    canvas.style.width = `${preview.width / dpr}px`
    canvas.style.height = 'auto'

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(preview.bitmap, 0, 0)
    }
  }, [preview])

  return (
    <section className="panel panel-preview">
      <div className="canvas-area">
        {hasText ? (
          <div className="preview-wrap">
            <canvas
              ref={canvasRef}
              className={isRendering && preview ? 'stale' : undefined}
              style={{ display: preview ? 'block' : 'none' }}
            />
            {isRendering && <div className="thinking">正在思考</div>}
          </div>
        ) : (
          <span className="placeholder">输入文字后预览</span>
        )}
        {previewError ? <p className="error">{previewError}</p> : null}
      </div>

      {hasText && (
        <div className="actions">
          <button
            className="export-btn"
            type="button"
            onClick={() => onCopyImage()}
          >
            <Icon icon="tabler:copy" width={15} height={15} />
            {copied === 'image' ? '已复制' : '复制图片'}
          </button>
          {IN_IFRAME ? (
            <a
              className="export-btn"
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon icon="tabler:external-link" width={15} height={15} />
              新标签页导出
            </a>
          ) : (
            <button
              className="export-btn"
              type="button"
              disabled={isExporting}
              onClick={() => onExport()}
            >
              <Icon icon="tabler:download" width={15} height={15} />
              {isExporting ? '导出中…' : '导出 PNG'}
            </button>
          )}
          <button
            className="export-btn"
            type="button"
            onClick={() => onCopyLink()}
          >
            <Icon icon="tabler:link" width={15} height={15} />
            {copied === 'link' ? '已复制' : '复制链接'}
          </button>
        </div>
      )}

      {hasText && (
        <p className="usage-hint">
          发出后右键「添加为表情」再发，尺寸才正常。
        </p>
      )}

      <a
        className="github-link"
        href="https://github.com/zhousiru/scale-new-heights-generator"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon="tabler:brand-github" width={16} height={16} />
        GitHub
      </a>
    </section>
  )
}
