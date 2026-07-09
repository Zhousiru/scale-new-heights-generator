import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { AngleKnob } from './AngleKnob'
import {
  type StickerControls,
  type StickerEnvelopeControls,
  type StickerFlavor,
  type StickerPaddingControls,
} from '../config/defaults'
import { STICKER_PRESETS, STICKER_PRESET_LIST } from '../config/presets'
import { colorInputValue } from '../utils/color'

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

interface StickerControlsPanelProps {
  controls: StickerControls
  updateControl: <K extends keyof StickerControls>(
    key: K,
    value: StickerControls[K],
  ) => void
  updateEnvelope: <K extends keyof StickerEnvelopeControls>(
    key: K,
    value: StickerEnvelopeControls[K],
  ) => void
  updatePadding: <K extends keyof StickerPaddingControls>(
    key: K,
    value: StickerPaddingControls[K],
  ) => void
  randomizeColors: () => void
  updateColorAt: (index: number, value: string) => void
  addColor: (at?: number) => void
  removeColor: (index: number) => void
  applyPresetText: (value: string) => void
}

export function StickerControlsPanel({
  controls,
  updateControl,
  updateEnvelope,
  updatePadding,
  randomizeColors,
  updateColorAt,
  addColor,
  removeColor,
  applyPresetText,
}: StickerControlsPanelProps) {
  const [selectedPresetText, setSelectedPresetText] = useState('')
  const activePreset = STICKER_PRESET_LIST.find((p) => p.text === selectedPresetText)
  const presetDirty =
    activePreset !== undefined &&
    (controls.flavor !== activePreset.flavor ||
      controls.icon !== activePreset.icon ||
      controls.iconTilt !== activePreset.iconTilt ||
      controls.envelope.gradientAngle !== activePreset.gradientAngle ||
      controls.envelope.colors.join(',') !== activePreset.colors.join(','))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [controls.text])

  return (
    <section className="panel panel-controls">
      <textarea
        ref={textareaRef}
        className="text-input"
        value={controls.text}
        placeholder="输入文本，回车换行"
        rows={2}
        onChange={(e) => updateControl('text', e.target.value)}
      />

      <div className="row toolbar-row">
        <div className="preset-cell">
          <select
            className="preset-select"
            value={selectedPresetText}
            onChange={(e) => {
              setSelectedPresetText(e.target.value)
              applyPresetText(e.target.value)
            }}
          >
            <option value="" disabled>
              选择预设文案…
            </option>
            {Object.entries(STICKER_PRESETS).map(([group, presets]) => (
              <optgroup key={group} label={group}>
                {presets.map((preset) => (
                  <option
                    key={preset.text}
                    value={preset.text}
                    style={{
                      color: preset.colors[preset.colors.length - 1],
                      fontWeight: 600,
                    }}
                  >
                    {preset.label ?? preset.text}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {presetDirty && (
            <button
              className="preset-reset"
              type="button"
              title="重置为预设初始参数"
              onClick={() => applyPresetText(activePreset.text)}
            >
              重置
            </button>
          )}
        </div>
        <div className="color-pair">
          {controls.envelope.colors.map((color, index) => (
            <Fragment key={index}>
              {controls.envelope.colors.length < 3 && (
                <button
                  className="swatch-insert"
                  type="button"
                  aria-label="在此处插入颜色"
                  title="在此处插入颜色"
                  onClick={() => addColor(index)}
                />
              )}
              <div className="color-swatch" style={{ backgroundColor: color }}>
                <input
                  type="color"
                  value={colorInputValue(color)}
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
            </Fragment>
          ))}
          {controls.envelope.colors.length < 3 && (
            <button
              className="swatch-insert"
              type="button"
              aria-label="在末尾添加颜色"
              title="在末尾添加颜色"
              onClick={() => addColor()}
            />
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

      <div className="field style-field">
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
        <form
          className="advanced-body"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="field">
            <span className="field-label">变换</span>
            <div className="toggle-group">
              <button
                className={`peak-toggle${controls.iconTilt ? ' active' : ''}`}
                type="button"
                aria-pressed={controls.iconTilt}
                title="图标倾斜（开启时前缀图标跟随字面旋转/斜切）"
                onClick={() => updateControl('iconTilt', !controls.iconTilt)}
              >
                {controls.iconTilt ? '图标倾斜' : '图标直立'}
              </button>
              <button
                className={`peak-toggle${controls.tilt ? ' active' : ''}`}
                type="button"
                aria-pressed={controls.tilt}
                title="文本倾斜（开启应用字面固有的旋转/斜切，关闭则文字直立）"
                onClick={() => updateControl('tilt', !controls.tilt)}
              >
                {controls.tilt ? '文本倾斜' : '文本直立'}
              </button>
              <button
                className={`peak-toggle${controls.peak ? ' active' : ''}`}
                type="button"
                aria-pressed={controls.peak}
                title="错位攀登（开启为高低错落效果，关闭则对齐平铺）"
                onClick={() => updateControl('peak', !controls.peak)}
              >
                {controls.peak ? '错位攀登' : '对齐平铺'}
              </button>
            </div>
          </div>

          <label className="field field-slider">
            <span className="field-label">抗锯齿</span>
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={controls.antialiasScale}
              onChange={(e) =>
                updateControl('antialiasScale', Number(e.target.value))
              }
            />
            <span className="field-value">
              {controls.antialiasScale.toFixed(1)}x
            </span>
          </label>

          <label className="field field-slider">
            <span className="field-label">描边厚度</span>
            <input
              type="range"
              min={0}
              max={48}
              value={controls.envelope.outlineStrokeWidth}
              onChange={(e) =>
                updateEnvelope('outlineStrokeWidth', Number(e.target.value))
              }
            />
            <span className="field-value">
              {controls.envelope.outlineStrokeWidth}
            </span>
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
        </form>
      </details>
    </section>
  )
}
