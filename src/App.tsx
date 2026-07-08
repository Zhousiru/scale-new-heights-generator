import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import './App.css'
import { AngleKnob } from './AngleKnob'
import {
  type StickerControls,
  type StickerEnvelopeControls,
  type StickerFlavor,
  type StickerPaddingControls,
} from './sticker/defaults'
import {
  controlsToSearch,
  searchToControls,
} from './sticker/searchParams'
import { deriveDepthColor, randomVividColor } from './sticker/color'
import {
  STICKER_PRESETS,
  STICKER_PRESET_GROUPS,
  type StickerPreset,
} from './sticker/presets'
import {
  renderStickerPreview,
  exportStickerBlob,
  cancelPendingPreviews,
  type PreviewResult,
} from './sticker/stickerWorker'

const IN_IFRAME = (() => {
  try { return window.self !== window.top } catch { return true }
})()

// 两种渲染风味，各用其参考表情包缩略图预览。
const STYLE_OPTIONS: {
  id: StickerFlavor
  label: string
  preview: string
}[] = [
  {
    id: 'snh',
    label: '勇攀高峰',
    preview:
      'https://s3-imfile.feishucdn.com/static-resource/v1/v3_00ut_736f2cf7-04c2-4b85-b8f4-fbf1fdd715eg~',
  },
  {
    id: 'bs',
    label: '字节范',
    preview:
      'https://s3-imfile.feishucdn.com/static-resource/v1/v2_5bfebc72-ea33-48e2-8a35-57590447360g~',
  },
]

function buildShareUrl(controls: StickerControls): string {
  const params = new URLSearchParams(controlsToSearch(controls))
  const query = params.toString()
  return `${location.origin}${location.pathname}${query ? `?${query}` : ''}`
}

function App() {
  const search = useSearch({ from: '__root__' })
  const navigate = useNavigate()

  const [controls, setControls] = useState<StickerControls>(() =>
    searchToControls(search),
  )
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  // 复制反馈：记录刚复制成功的按钮（'image' | 'link'），短暂显示「已复制」。
  const [copied, setCopied] = useState<'image' | 'link' | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [renderControls, setRenderControls] = useState(controls)
  useEffect(() => {
    const timer = setTimeout(() => setRenderControls(controls), 250)
    return () => clearTimeout(timer)
  }, [controls])

  // 同步控件 → URL query（用 replace，避免刷屏历史记录）。
  useEffect(() => {
    void navigate({ to: '.', search: () => controlsToSearch(renderControls), replace: true })
  }, [renderControls, navigate])

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
        const message = error instanceof Error ? error.message : '渲染失败。'
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
    // 只设置 CSS 宽度；高度保持 `auto`（见 App.css），让浏览器按固有比例推导，
    // 这样在 `max-width: 100%` 下缩小时两个轴同比缩放，永远不会压扁表情包。
    canvas.style.width = `${preview.width / dpr}px`
    canvas.style.height = 'auto'

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

  const updatePadding = <K extends keyof StickerPaddingControls>(key: K, value: StickerPaddingControls[K]) => {
    setControls((c) => ({ ...c, padding: { ...c.padding, [key]: value } }))
  }

  const randomizeColors = () => {
    const color = randomVividColor(controls.envelope.colors[0] ?? '#76baf4')
    setControls((c) => ({
      ...c,
      envelope: { ...c.envelope, colors: [color] },
    }))
  }

  const updateColorAt = (index: number, value: string) => {
    setControls((c) => {
      const colors = [...c.envelope.colors]
      colors[index] = value
      return { ...c, envelope: { ...c.envelope, colors } }
    })
  }

  const addColor = () => {
    setControls((c) => {
      if (c.envelope.colors.length >= 3) return c
      const last = c.envelope.colors[c.envelope.colors.length - 1] ?? '#76baf4'
      return {
        ...c,
        envelope: { ...c.envelope, colors: [...c.envelope.colors, deriveDepthColor(last)] },
      }
    })
  }

  const removeColor = (index: number) => {
    setControls((c) => {
      if (c.envelope.colors.length <= 1) return c
      const colors = c.envelope.colors.filter((_, i) => i !== index)
      return { ...c, envelope: { ...c.envelope, colors } }
    })
  }

  const applyPreset = (preset: StickerPreset) => {
    setControls((c) => ({
      ...c,
      text: preset.text,
      flavor: preset.flavor,
      icon: preset.icon,
      envelope: {
        ...c.envelope,
        colors: preset.colors,
        gradientAngle: preset.gradientAngle,
      },
    }))
  }

  const handlePresetSelect = (value: string) => {
    const preset = STICKER_PRESETS.find((p) => p.text === value)
    if (preset) applyPreset(preset)
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
      const message = error instanceof Error ? error.message : '导出失败。'
      setPreviewError(message)
    } finally {
      setIsExporting(false)
    }
  }

  // 复制成功后，短暂展示「已复制」再复原按钮文案。
  const flashCopied = (which: 'image' | 'link') => {
    setCopied(which)
    setTimeout(() => setCopied((prev) => (prev === which ? null : prev)), 1500)
  }

  const handleCopyImage = async () => {
    if (!hasText) return
    try {
      const blob = await exportStickerBlob(controls)
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      flashCopied('image')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '复制图片失败。'
      setPreviewError(message)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(controls))
      flashCopied('link')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '复制链接失败。'
      setPreviewError(message)
    }
  }

  const activePreset = STICKER_PRESETS.find((p) => p.text === controls.text)

  return (
    <main className="app">
      <div className="layout">
        <section className="panel panel-controls">
          <textarea
            className="text-input"
            value={controls.text}
            placeholder="输入文本，回车换行"
            rows={2}
            onChange={(e) => updateControl('text', e.target.value)}
          />

          <div className="row toolbar-row">
            <select
              className="preset-select"
              value={activePreset ? activePreset.text : ''}
              onChange={(e) => handlePresetSelect(e.target.value)}
            >
              <option value="" disabled>
                选择预设文案…
              </option>
              {STICKER_PRESET_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {STICKER_PRESETS.filter((preset) => preset.group === group).map(
                    (preset) => (
                      <option
                        key={preset.text}
                        value={preset.text}
                        style={{ color: preset.colors[preset.colors.length - 1], fontWeight: 600 }}
                      >
                        {preset.text}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </select>
            <div className="color-pair">
              {controls.envelope.colors.map((color, index) => (
                <div
                  key={index}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => updateColorAt(index, e.target.value)}
                  />
                  {controls.envelope.colors.length > 1 && (
                    <button
                      className="swatch-remove"
                      type="button"
                      title="移除该颜色"
                      onClick={() => removeColor(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {controls.envelope.colors.length < 3 && (
                <button
                  className="swatch-add"
                  type="button"
                  title="添加渐变颜色"
                  onClick={addColor}
                >
                  +
                </button>
              )}
            </div>
            <button
              className="icon-btn"
              type="button"
              title="随机同色系/邻色系配色"
              onClick={randomizeColors}
            >
              🎲
            </button>
            <AngleKnob
              value={controls.envelope.gradientAngle}
              onChange={(v) => updateEnvelope('gradientAngle', v)}
            />
          </div>

          <label className="field icon-field">
            <span className="field-label">前缀图标</span>
            <div className="icon-input-wrap">
              <input
                className="icon-input"
                type="text"
                value={controls.icon}
                placeholder="例如 mdi:rocket"
                onChange={(e) => updateControl('icon', e.target.value)}
              />
              {controls.icon.length > 0 && (
                <button
                  className="icon-clear"
                  type="button"
                  title="清空图标"
                  onClick={() => updateControl('icon', '')}
                >
                  ×
                </button>
              )}
            </div>
            <a
              className="field-hint"
              href="https://yesicon.app/"
              target="_blank"
              rel="noopener noreferrer"
            >
              找图标
            </a>
          </label>

          <details className="advanced">
            <summary className="advanced-summary">高级设置</summary>
            <div className="advanced-body">
              <label className="field">
                <span className="field-label">样式</span>
                <div className="style-toggle">
                  {STYLE_OPTIONS.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      className={`style-option${controls.flavor === style.id ? ' active' : ''}`}
                      onClick={() => updateControl('flavor', style.id)}
                      title={style.label}
                    >
                      <img
                        className="style-preview"
                        src={style.preview}
                        alt={style.label}
                        draggable={false}
                      />
                      <span className="style-label">{style.label}</span>
                    </button>
                  ))}
                </div>
              </label>

              <label className="field">
                <span className="field-label">高峰模式</span>
                <div className="toggle-group">
                  <button
                    className={`peak-toggle${controls.peak ? ' active' : ''}`}
                    type="button"
                    aria-pressed={controls.peak}
                    title="高峰模式（开启为错位攀登效果，关闭则对齐平铺）"
                    onClick={() => updateControl('peak', !controls.peak)}
                  >
                    {controls.peak ? '错位攀登' : '对齐平铺'}
                  </button>
                  <button
                    className={`peak-toggle${controls.tilt ? ' active' : ''}`}
                    type="button"
                    aria-pressed={controls.tilt}
                    title="字符倾斜（开启应用字面固有的旋转/斜切，关闭则字形直立）"
                    onClick={() => updateControl('tilt', !controls.tilt)}
                  >
                    {controls.tilt ? '字符倾斜' : '字形直立'}
                  </button>
                </div>
              </label>

              <label className="field field-slider">
                <span className="field-label">描边厚度</span>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={controls.envelope.outlineStrokeWidth}
                  onChange={(e) => updateEnvelope('outlineStrokeWidth', Number(e.target.value))}
                />
                <span className="field-value">{controls.envelope.outlineStrokeWidth}</span>
              </label>

              <label className="field field-slider">
                <span className="field-label">左右边距</span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={controls.padding.x}
                  onChange={(e) => updatePadding('x', Number(e.target.value))}
                />
                <span className="field-value">{controls.padding.x}</span>
              </label>

              <label className="field field-slider">
                <span className="field-label">上下边距</span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={controls.padding.y}
                  onChange={(e) => updatePadding('y', Number(e.target.value))}
                />
                <span className="field-value">{controls.padding.y}</span>
              </label>

              <label className="field field-slider">
                <span className="field-label">行高</span>
                <input
                  type="range"
                  min={0.8}
                  max={2}
                  step={0.05}
                  value={controls.lineHeight}
                  onChange={(e) => updateControl('lineHeight', Number(e.target.value))}
                />
                <span className="field-value">{controls.lineHeight.toFixed(2)}</span>
              </label>
            </div>
          </details>
        </section>

        <section className="panel panel-preview">
          <div className="canvas-area">
            {hasText ? (
              <div className="preview-wrap">
                <canvas
                  ref={canvasRef}
                  className={isRendering && preview ? 'stale' : undefined}
                  style={{ display: preview ? 'block' : 'none' }}
                />
                {isRendering && <div className="thinking">正在思考</div>}
              </div>
            ) : (
              <span className="placeholder">输入文字后预览</span>
            )}
            {previewError ? <p className="error">{previewError}</p> : null}
          </div>

          {hasText && (
            <div className="actions">
              <button
                className="export-btn"
                type="button"
                onClick={() => void handleCopyImage()}
              >
                <Icon icon="tabler:copy" width={15} height={15} />
                {copied === 'image' ? '已复制' : '复制图片'}
              </button>
              {IN_IFRAME ? (
                <a
                  className="export-btn"
                  href={buildShareUrl(controls)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon icon="tabler:external-link" width={15} height={15} />
                  新标签页导出
                </a>
              ) : (
                <button
                  className="export-btn"
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleExport()}
                >
                  <Icon icon="tabler:download" width={15} height={15} />
                  {isExporting ? '导出中…' : '导出 PNG'}
                </button>
              )}
              <button
                className="export-btn"
                type="button"
                onClick={() => void handleCopyLink()}
              >
                <Icon icon="tabler:link" width={15} height={15} />
                {copied === 'link' ? '已复制' : '复制链接'}
              </button>
            </div>
          )}

          {hasText && (
            <p className="usage-hint">
              发送时复制图片粘贴到聊天框，发出后右键「添加为表情」，尺寸和形态才正常。
            </p>
          )}

          <a
            className="github-link"
            href="https://github.com/zhousiru/scale-new-heights-generator"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="tabler:brand-github" width={16} height={16} />
            GitHub
          </a>
        </section>
      </div>
    </main>
  )
}

export default App
