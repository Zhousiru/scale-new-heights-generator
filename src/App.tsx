import './App.css'
import { StickerControlsPanel } from './sticker/components/StickerControlsPanel'
import { StickerPreviewPanel } from './sticker/components/StickerPreviewPanel'
import { useStickerEditor } from './sticker/hooks/useStickerEditor'

function App() {
  const sticker = useStickerEditor()

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
      <StickerPreviewPanel
        preview={sticker.preview}
        previewError={sticker.previewError}
        isRendering={sticker.isRendering}
        isExporting={sticker.isExporting}
        copied={sticker.copied}
        hasText={sticker.hasText}
        shareUrl={sticker.shareUrl}
        onCopyImage={() => void sticker.handleCopyImage()}
        onExport={() => void sticker.handleExport()}
        onCopyLink={() => void sticker.handleCopyLink()}
      />
    </main>
  )
}

export default App
