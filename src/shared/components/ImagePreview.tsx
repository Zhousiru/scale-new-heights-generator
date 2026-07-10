import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button } from '../ui/button'

interface PreviewBase {
  width: number
  height: number
  mime: string
  extension: string
}

export type PreviewResult =
  | (PreviewBase & { kind: 'bitmap'; bitmap: ImageBitmap })
  | (PreviewBase & { kind: 'blob'; blob: Blob })

export interface ImageFileResult {
  blob: Blob
  mime: string
  extension: string
}

export function disposePreview(preview: PreviewResult | null): void {
  if (preview?.kind === 'bitmap') preview.bitmap.close()
}

interface CanvasPreviewProps {
  preview: PreviewResult | null
  previewError: string | null
  isRendering: boolean
  hasContent: boolean
  placeholder: string
}

interface PreviewActionsProps {
  copied: 'image' | 'link' | null
  isExporting: boolean
  shareUrl: string
  exportLabel?: string
  onCopyImage: () => void
  onExport: () => void
  onCopyLink: () => void
}

const IN_IFRAME = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

export function CanvasPreview({
  preview,
  previewError,
  isRendering,
  hasContent,
  placeholder,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const displayWidth = preview ? cssPixelWidth(preview.width) : undefined

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview || preview.kind !== 'bitmap') return

    canvas.width = preview.width
    canvas.height = preview.height
    canvas.style.maxWidth = `min(100%, ${cssPixelWidth(preview.width)}px)`
    canvas.style.height = 'auto'

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(preview.bitmap, 0, 0)
  }, [preview])

  useEffect(() => {
    if (!preview || preview.kind !== 'blob') {
      setImageUrl(null)
      return
    }

    const url = URL.createObjectURL(preview.blob)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [preview])

  return (
    <div className="canvas-area">
      {hasContent ? (
        <div className="preview-wrap">
          <canvas
            ref={canvasRef}
            className={isRendering && preview?.kind === 'bitmap' ? 'stale' : undefined}
            style={{ display: preview?.kind === 'bitmap' ? 'block' : 'none' }}
          />
          {preview?.kind === 'blob' && imageUrl ? (
            <img
              className={isRendering ? 'stale' : undefined}
              src={imageUrl}
              width={preview.width}
              height={preview.height}
              style={{ width: '100%', maxWidth: `${displayWidth}px` }}
              alt="预览"
            />
          ) : null}
          {isRendering && <div className="thinking">正在思考</div>}
        </div>
      ) : (
        <span className="placeholder">{placeholder}</span>
      )}
      {previewError ? <p className="error">{previewError}</p> : null}
    </div>
  )
}

function cssPixelWidth(width: number): number {
  return width / (window.devicePixelRatio || 1)
}

export function PreviewActions({
  copied,
  isExporting,
  shareUrl,
  exportLabel = '导出 PNG',
  onCopyImage,
  onExport,
  onCopyLink,
}: PreviewActionsProps) {
  return (
    <div className="actions">
      <Button
        variant="secondary"
        type="button"
        onClick={onCopyImage}
      >
        <Icon icon="tabler:copy" width={15} height={15} />
        {copied === 'image' ? '已复制' : '复制图片'}
      </Button>
      {IN_IFRAME ? (
        <Button variant="secondary" asChild>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="tabler:external-link" width={15} height={15} />
            新标签页导出
          </a>
        </Button>
      ) : (
        <Button
          variant="secondary"
          type="button"
          disabled={isExporting}
          onClick={onExport}
        >
          <Icon icon="tabler:download" width={15} height={15} />
          {isExporting ? '导出中…' : exportLabel}
        </Button>
      )}
      <Button
        variant="secondary"
        type="button"
        onClick={onCopyLink}
      >
        <Icon icon="tabler:link" width={15} height={15} />
        {copied === 'link' ? '已复制' : '复制链接'}
      </Button>
    </div>
  )
}
