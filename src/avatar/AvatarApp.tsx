import { AvatarControlsPanel } from './components/AvatarControlsPanel'
import { ToolPreviewPanel } from '../shared/components/ToolPreviewPanel'
import { useAvatarEditor } from './hooks/useAvatarEditor'

export function AvatarApp() {
  const avatar = useAvatarEditor()

  const previewPanel = (
    <ToolPreviewPanel
      preview={avatar.preview}
      previewError={avatar.previewError}
      isRendering={avatar.isRendering}
      isExporting={avatar.isExporting}
      copied={avatar.copied}
      hasText={avatar.hasText}
      shareUrl={avatar.shareUrl}
      editorUrl={avatar.editorUrl}
      simpleMode={avatar.isSimpleMode}
      exportLabel={avatar.exportLabel}
      onCopyImage={() => void avatar.handleCopyImage()}
      onExport={() => void avatar.handleExport()}
      onCopyLink={() => void avatar.handleCopyLink()}
      placeholder="输入群名后预览"
      switchTool="sticker"
      switchIcon="tabler:mountain"
      switchLabel="高峰生成"
    />
  )

  if (avatar.isSimpleMode) {
    return <main className="app-simple">{previewPanel}</main>
  }

  return (
    <main className="app">
      <AvatarControlsPanel
        controls={avatar.controls}
        updateControl={avatar.updateControl}
      />
      {previewPanel}
    </main>
  )
}
