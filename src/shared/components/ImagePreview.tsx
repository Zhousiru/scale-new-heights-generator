import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button } from '../ui/button'
import { cn } from '../utils/cn'

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
  /** HDR(JPEG) 模式下 JPG 不易复制，隐藏复制图片按钮 */
  canCopyImage?: boolean
  onCopyImage: () => void
  onExport: () => void
  onCopyLink: () => void
}

/** 当前页面是否运行在 iframe 中 */
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
  const showBitmap = preview?.kind === 'bitmap'
  const previewVars = preview
    ? {
        '--preview-width': `${cssPixelSize(preview.width)}px`,
        '--preview-height': `${cssPixelSize(preview.height)}px`,
      } as CSSProperties
    : undefined

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview || preview.kind !== 'bitmap') return

    canvas.width = preview.width
    canvas.height = preview.height

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
        <div className="preview-wrap" style={previewVars}>
          <canvas
            ref={canvasRef}
            className={cn(
              'preview-media',
              !showBitmap && 'preview-media-hidden',
              isRendering && showBitmap && 'stale',
            )}
          />
          {preview?.kind === 'blob' && imageUrl ? (
            <img
              className={cn('preview-media', isRendering && 'stale')}
              src={imageUrl}
              width={preview.width}
              height={preview.height}
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

function cssPixelSize(size: number): number {
  return size / (window.devicePixelRatio || 1)
}

export function PreviewActions({
  copied,
  isExporting,
  shareUrl,
  exportLabel = '导出 PNG',
  canCopyImage = true,
  onCopyImage,
  onExport,
  onCopyLink,
}: PreviewActionsProps) {
  return (
    <div className="actions">
      {canCopyImage && (
        <Button
          variant="secondary"
          type="button"
          onClick={onCopyImage}
        >
          <Icon icon="tabler:copy" />
          {copied === 'image' ? '已复制' : '复制图片'}
        </Button>
      )}
      {IN_IFRAME ? (
        <Button variant="secondary" asChild>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="tabler:external-link" />
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
          <Icon icon="tabler:download" />
          {isExporting ? '导出中…' : exportLabel}
        </Button>
      )}
      <Button
        variant="secondary"
        type="button"
        onClick={onCopyLink}
      >
        <Icon icon="tabler:link" />
        {copied === 'link' ? '已复制' : '复制链接'}
      </Button>
    </div>
  )
}
