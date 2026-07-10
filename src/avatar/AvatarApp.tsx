import { AvatarControlsPanel } from './components/AvatarControlsPanel'
import { AvatarPreviewPanel } from './components/AvatarPreviewPanel'
import { useAvatarEditor } from './hooks/useAvatarEditor'

export function AvatarApp() {
  const avatar = useAvatarEditor()

  return (
    <main className="app">
      <AvatarControlsPanel
        controls={avatar.controls}
        updateControl={avatar.updateControl}
      />
      <AvatarPreviewPanel
        preview={avatar.preview}
        previewError={avatar.previewError}
        isRendering={avatar.isRendering}
        isExporting={avatar.isExporting}
        copied={avatar.copied}
        hasText={avatar.hasText}
        shareUrl={avatar.shareUrl}
        onCopyImage={() => void avatar.handleCopyImage()}
        onExport={() => void avatar.handleExport()}
        onCopyLink={() => void avatar.handleCopyLink()}
        exportLabel={avatar.exportLabel}
      />
    </main>
  )
}
