import {
  useEffect,
  useRef,
  useState,
} from 'react'
import './App.css'
import { AngleKnob } from './AngleKnob'
import {
  type StickerControls,
  type StickerEnvelopeControls,
} from './sticker/defaults'
import {
  controlsToHash,
  hashToControls,
} from './sticker/hashParams'
import {
  renderStickerPreview,
  exportStickerBlob,
  cancelPendingPreviews,
  type PreviewResult,
} from './sticker/stickerWorker'

const IN_IFRAME = (() => {
  try { return window.self !== window.top } catch { return true }
})()

function App() {
  const [controls, setControls] = useState(() => hashToControls(location.hash))
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [renderControls, setRenderControls] = useState(controls)
  useEffect(() => {
    const timer = setTimeout(() => setRenderControls(controls), 250)
    return () => clearTimeout(timer)
  }, [controls])

  // Sync controls → hash
  useEffect(() => {
    const hash = controlsToHash(renderControls)
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search)
  }, [renderControls])

  const hasText = controls.text.trim().length > 0

  useEffect(() => {
    if (renderControls.text.trim().length === 0) {
      setPreview((prev) => {
        prev?.bitmap.close()
        return null
      })
      setPreviewError(null)
      setIsRendering(false)
      return
    }

    let active = true
    setPreviewError(null)
    setIsRendering(true)

    void renderStickerPreview(renderControls)
      .then((result) => {
        if (active) {
          setPreview((prev) => {
            prev?.bitmap.close()
            return result
          })
          setIsRendering(false)
        } else {
          result.bitmap.close()
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof Error ? error.message : 'Rendering failed.'
        setPreview((prev) => {
          prev?.bitmap.close()
          return null
        })
        setPreviewError(message)
        setIsRendering(false)
      })

    return () => {
      active = false
      cancelPendingPreviews()
    }
  }, [renderControls])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = preview.width
    canvas.height = preview.height
    canvas.style.width = `${preview.width / dpr}px`
    canvas.style.height = `${preview.height / dpr}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(preview.bitmap, 0, 0)
    }
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
      const blob = await exportStickerBlob(controls)
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
          <div className="preview-wrap">
            <canvas
              ref={canvasRef}
              className={isRendering && preview ? 'stale' : undefined}
              style={{ display: preview ? 'block' : 'none' }}
            />
            {isRendering && <div className="spinner" />}
          </div>
        ) : (
          <span className="placeholder">输入文字后预览</span>
        )}
        {previewError ? <p className="error">{previewError}</p> : null}
      </div>

      {hasText && (
        IN_IFRAME ? (
          <span className="iframe-hint">iframe 环境受限，请右键或长按预览图保存</span>
        ) : (
          <button
            className="export-btn"
            type="button"
            disabled={isExporting}
            onClick={() => void handleExport()}
          >
            {isExporting ? '导出中…' : '导出 PNG'}
          </button>
        )
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
