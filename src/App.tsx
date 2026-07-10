import { StickerControlsPanel } from './sticker/components/StickerControlsPanel'
import { StickerPreviewPanel } from './sticker/components/StickerPreviewPanel'
import { useStickerEditor } from './sticker/hooks/useStickerEditor'

function App() {
  const sticker = useStickerEditor()

  const previewPanel = (
    <StickerPreviewPanel
      preview={sticker.preview}
      previewError={sticker.previewError}
      isRendering={sticker.isRendering}
      isExporting={sticker.isExporting}
      copied={sticker.copied}
      hasText={sticker.hasText}
      shareUrl={sticker.shareUrl}
      editorUrl={sticker.editorUrl}
      simpleMode={sticker.isSimpleMode}
      exportLabel={sticker.exportLabel}
      onCopyImage={() => void sticker.handleCopyImage()}
      onExport={() => void sticker.handleExport()}
      onCopyLink={() => void sticker.handleCopyLink()}
    />
  )

  if (sticker.isSimpleMode) {
    return <main className="app app-simple">{previewPanel}</main>
  }

  return (
    <main className="app">
      <StickerControlsPanel
        controls={sticker.controls}
        updateControl={sticker.updateControl}
        updateEnvelope={sticker.updateEnvelope}
        updatePadding={sticker.updatePadding}
        randomizeColors={sticker.randomizeColors}
        updateColorAt={sticker.updateColorAt}
        addColor={sticker.addColor}
        removeColor={sticker.removeColor}
        applyPresetText={sticker.applyPresetText}
      />
      {previewPanel}
    </main>
  )
}

export default App
