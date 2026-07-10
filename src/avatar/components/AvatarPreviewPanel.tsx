import {
  CanvasPreview,
  PreviewActions,
  type PreviewResult,
} from '../../shared/components/ImagePreview'
import { ToolFooter } from '../../shared/components/ToolFooter'
import { UsageHintCarousel } from '../../shared/components/UsageHintCarousel'
import { loadToolSearch } from '../../shared/utils/toolState'
import type { CopiedTarget } from '../hooks/useAvatarEditor'

interface AvatarPreviewPanelProps {
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
  exportLabel: string
}

export function AvatarPreviewPanel({
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
  exportLabel,
}: AvatarPreviewPanelProps) {
  return (
    <section className="panel panel-preview">
      <CanvasPreview
        preview={preview}
        previewError={previewError}
        isRendering={isRendering}
        hasContent={hasText}
        placeholder="输入群名后预览"
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
        to="/"
        icon="tabler:mountain"
        label="高峰生成"
        search={loadToolSearch('sticker')}
      />
    </section>
  )
}
