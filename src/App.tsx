import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react'
import './App.css'
import { AngleKnob } from './AngleKnob'
import {
  DEFAULT_STICKER_CONTROLS,
  type StickerControls,
  type StickerEnvelopeControls,
} from './sticker/defaults'
import { renderSticker, type RenderResult } from './sticker/renderSticker'

function App() {
  const [controls, setControls] = useState<StickerControls>(DEFAULT_STICKER_CONTROLS)
  const [preview, setPreview] = useState<RenderResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const previewCanvasRef = useRef<HTMLDivElement | null>(null)
  const deferredControls = useDeferredValue(controls)

  const hasText = controls.text.trim().length > 0

  useEffect(() => {
    if (deferredControls.text.trim().length === 0) {
      startTransition(() => {
        setPreview(null)
        setPreviewError(null)
      })
      return
    }

    let active = true
    setPreviewError(null)

    void renderSticker(deferredControls)
      .then((result) => {
        if (active) startTransition(() => setPreview(result))
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Rendering failed.'
        startTransition(() => {
          setPreview(null)
          setPreviewError(message)
        })
      })

    return () => { active = false }
  }, [deferredControls])

  useEffect(() => {
    const container = previewCanvasRef.current
    if (!container) return
    if (!preview) {
      container.replaceChildren()
      return
    }
    const canvas = preview.canvas
    const dpr = window.devicePixelRatio || 1
    canvas.style.width = `${canvas.width / dpr}px`
    canvas.style.height = `${canvas.height / dpr}px`
    container.replaceChildren(canvas)
  }, [preview])

  const updateControl = <K extends keyof StickerControls>(key: K, value: StickerControls[K]) => {
    setControls((c) => ({ ...c, [key]: value }))
  }

  const updateEnvelope = <K extends keyof StickerEnvelopeControls>(key: K, value: StickerEnvelopeControls[K]) => {
    setControls((c) => ({ ...c, envelope: { ...c.envelope, [key]: value } }))
  }

  const handleExport = async () => {
    if (!hasText) return
    setIsExporting(true)
    try {
      const result = await renderSticker(controls)
      const blob = await result.toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sticker.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Export failed.'
      setPreviewError(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="app">
      <div className="toolbar">
        <input
          className="text-input"
          type="text"
          value={controls.text}
          placeholder="输入文本"
          onChange={(e) => updateControl('text', e.target.value)}
        />
        <div className="color-pair">
          <div
            className="color-swatch"
            style={{ backgroundColor: controls.envelope.gradientStart }}
          >
            <input
              type="color"
              value={controls.envelope.gradientStart}
              onChange={(e) => updateEnvelope('gradientStart', e.target.value)}
            />
          </div>
          <div
            className="color-swatch"
            style={{ backgroundColor: controls.envelope.gradientEnd }}
          >
            <input
              type="color"
              value={controls.envelope.gradientEnd}
              onChange={(e) => updateEnvelope('gradientEnd', e.target.value)}
            />
          </div>
        </div>
        <AngleKnob
          value={controls.envelope.gradientAngle}
          onChange={(v) => updateEnvelope('gradientAngle', v)}
        />
      </div>

      <div className="canvas-area">
        {hasText ? (
          <div ref={previewCanvasRef} />
        ) : (
          <span className="placeholder">输入文字后预览</span>
        )}
        {previewError ? <p className="error">{previewError}</p> : null}
      </div>

      {hasText && (
        <button
          className="export-btn"
          type="button"
          disabled={isExporting}
          onClick={() => void handleExport()}
        >
          {isExporting ? '导出中…' : '导出 PNG'}
        </button>
      )}

      <footer className="footer">
        <a href="https://github.com/zhousiru/scale-new-heights-generator" target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub
        </a>
      </footer>
    </main>
  )
}

export default App
