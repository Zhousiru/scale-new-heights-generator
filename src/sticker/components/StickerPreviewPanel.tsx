import { Icon } from '@iconify/react'
import { CanvasPreview, PreviewActions } from '../../shared/components/ImagePreview'
import { ToolFooter } from '../../shared/components/ToolFooter'
import { UsageHintCarousel } from '../../shared/components/UsageHintCarousel'
import { Button } from '../../shared/ui/button'
import { loadToolSearch } from '../../shared/utils/toolState'
import type { CopiedTarget } from '../hooks/useStickerEditor'
import type { PreviewResult } from '../worker/stickerWorker'

interface StickerPreviewPanelProps {
  preview: PreviewResult | null
  previewError: string | null
  isRendering: boolean
  isExporting: boolean
  copied: CopiedTarget | null
  hasText: boolean
  shareUrl: string
  editorUrl: string
  simpleMode?: boolean
  exportLabel: string
  onCopyImage: () => void
  onExport: () => void
  onCopyLink: () => void
}

function SimpleFooter({ editorUrl }: { editorUrl: string }) {
  return (
    <div className="simple-footer">
      <Button variant="secondary" asChild>
        <a href={editorUrl} target="_top">
          <Icon icon="tabler:edit" width={15} height={15} />
          编辑
        </a>
      </Button>
    </div>
  )
}

export function StickerPreviewPanel({
  preview,
  previewError,
  isRendering,
  isExporting,
  copied,
  hasText,
  shareUrl,
  editorUrl,
  simpleMode = false,
  exportLabel,
  onCopyImage,
  onExport,
  onCopyLink,
}: StickerPreviewPanelProps) {
  if (simpleMode) {
    return (
      <section className="panel panel-preview panel-preview-simple">
        <CanvasPreview
          preview={preview}
          previewError={previewError}
          isRendering={isRendering}
          hasContent={hasText}
          placeholder="输入文字后预览"
        />
        <SimpleFooter editorUrl={editorUrl} />
      </section>
    )
  }

  return (
    <section className="panel panel-preview">
      <CanvasPreview
        preview={preview}
        previewError={previewError}
        isRendering={isRendering}
        hasContent={hasText}
        placeholder="输入文字后预览"
      />
      {hasText && (
        <PreviewActions
          copied={copied}
          isExporting={isExporting}
          shareUrl={shareUrl}
          exportLabel={exportLabel}
          onCopyImage={onCopyImage}
          onExport={onExport}
          onCopyLink={onCopyLink}
        />
      )}
      {hasText && <UsageHintCarousel />}
      <ToolFooter
        to="/avatar"
        icon="tabler:user-square-rounded"
        label="飞书头像"
        search={loadToolSearch('avatar')}
      />
    </section>
  )
}
