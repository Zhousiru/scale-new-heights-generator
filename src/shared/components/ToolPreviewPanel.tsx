import {
  CanvasPreview,
  PreviewActions,
  type PreviewResult,
} from './ImagePreview'
import { SimpleEditFooter } from './SimpleEditFooter'
import { ToolFooter } from './ToolFooter'
import { UsageHintCarousel } from './UsageHintCarousel'
import { useIntranetAvailable } from '../hooks/useIntranetAvailable'
import type { Tool } from '../utils/tool'

export type CopiedTarget = 'image' | 'link'

interface ToolPreviewPanelProps {
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
  canCopyImage?: boolean
  onCopyImage: () => void
  onExport: () => void
  onCopyLink: () => void
  placeholder: string
  switchTool: Tool
  switchIcon: string
  switchLabel: string
}

export function ToolPreviewPanel({
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
  canCopyImage = true,
  onCopyImage,
  onExport,
  onCopyLink,
  placeholder,
  switchTool,
  switchIcon,
  switchLabel,
}: ToolPreviewPanelProps) {
  const showIntranetContent = useIntranetAvailable()

  if (simpleMode) {
    return (
      <section className="panel panel-preview panel-preview-simple">
        <CanvasPreview
          preview={preview}
          previewError={previewError}
          isRendering={isRendering}
          hasContent={hasText}
          placeholder={placeholder}
        />
        <SimpleEditFooter editorUrl={editorUrl} />
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
        placeholder={placeholder}
      />
      {hasText && (
        <PreviewActions
          copied={copied}
          isExporting={isExporting}
          shareUrl={shareUrl}
          exportLabel={exportLabel}
          canCopyImage={canCopyImage}
          onCopyImage={onCopyImage}
          onExport={onExport}
          onCopyLink={onCopyLink}
        />
      )}
      {hasText && (
        <UsageHintCarousel showIntranetHints={showIntranetContent} />
      )}
      <ToolFooter
        tool={switchTool}
        icon={switchIcon}
        label={switchLabel}
        showIntranetLink={showIntranetContent}
      />
    </section>
  )
}
