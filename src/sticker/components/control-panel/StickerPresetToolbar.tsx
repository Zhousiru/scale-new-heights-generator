import { Fragment, useState, type CSSProperties } from 'react'
import { Icon } from '@iconify/react'
import { AngleKnob } from '../../../shared/components/AngleKnob'
import { Button } from '../../../shared/ui/button'
import { Select } from '../../../shared/ui/select'
import type {
  StickerControls,
  StickerEnvelopeControls,
} from '../../config/defaults'
import {
  STICKER_PRESET_GROUPS,
  STICKER_PRESET_LIST,
  type StickerPreset,
} from '../../config/presets'
import { colorInputValue } from '../../utils/color'

interface StickerPresetToolbarProps {
  controls: StickerControls
  updateEnvelope: <K extends keyof StickerEnvelopeControls>(
    key: K,
    value: StickerEnvelopeControls[K],
  ) => void
  randomizeColors: () => void
  updateColorAt: (index: number, value: string) => void
  addColor: (at?: number) => void
  removeColor: (index: number) => void
  applyPresetText: (value: string) => void
}

export function StickerPresetToolbar({
  controls,
  updateEnvelope,
  randomizeColors,
  updateColorAt,
  addColor,
  removeColor,
  applyPresetText,
}: StickerPresetToolbarProps) {
  const [selectedPresetText, setSelectedPresetText] = useState('')
  const activePreset = STICKER_PRESET_LIST.find((p) => p.text === selectedPresetText)
  const presetDirty =
    activePreset !== undefined &&
    (controls.flavor !== activePreset.flavor ||
      controls.icon !== activePreset.icon ||
      controls.iconTilt !== activePreset.iconTilt ||
      controls.envelope.gradientAngle !== activePreset.gradientAngle ||
      controls.envelope.colors.join(',') !== activePreset.colors.join(','))

  return (
    <div className="toolbar-row">
      <div className="preset-cell">
        <Select
          className="preset-select"
          contentClassName="preset-select-content"
          viewportClassName="preset-select-viewport"
          value={selectedPresetText}
          placeholder="选择预设文案…"
          groups={Object.entries(STICKER_PRESET_GROUPS).map(([group, presets]) => ({
            label: group,
            options: presets.map((preset) => ({
              value: preset.text,
              label: <PresetOption preset={preset} />,
            })),
          }))}
          onValueChange={(value) => {
            setSelectedPresetText(value)
            applyPresetText(value)
          }}
        />
        {presetDirty && (
          <Button
            className="preset-reset"
            variant="secondary"
            size="sm"
            type="button"
            title="重置为预设初始参数"
            onClick={() => applyPresetText(activePreset.text)}
          >
            重置
          </Button>
        )}
      </div>

      <div className="color-pair">
        {controls.envelope.colors.map((color, index) => (
          <Fragment key={index}>
            {controls.envelope.colors.length < 3 && (
              <Button
                className="swatch-insert"
                variant="ghost"
                size="icon"
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
                <Button
                  className="swatch-remove"
                  variant="secondary"
                  size="icon"
                  type="button"
                  title="移除该颜色"
                  onClick={() => removeColor(index)}
                >
                  ×
                </Button>
              )}
            </div>
          </Fragment>
        ))}
        {controls.envelope.colors.length < 3 && (
          <Button
            className="swatch-insert"
            variant="ghost"
            size="icon"
            type="button"
            aria-label="在末尾添加颜色"
            title="在末尾添加颜色"
            onClick={() => addColor()}
          />
        )}
      </div>

      <Button
        className="icon-btn"
        variant="secondary"
        size="icon"
        type="button"
        title="随机同色系/邻色系配色"
        onClick={randomizeColors}
      >
        🎲
      </Button>
      <AngleKnob
        value={controls.envelope.gradientAngle}
        onChange={(value) => updateEnvelope('gradientAngle', value)}
      />
    </div>
  )
}

function PresetOption({
  preset,
}: {
  preset: StickerPreset
}) {
  return (
    <span
      className={`preset-option${preset.icon ? '' : ' preset-option-text-only'}`}
      style={{
        '--preset-gradient': `linear-gradient(${preset.gradientAngle}deg, ${preset.colors.join(', ')})`,
      } as CSSProperties}
    >
      {preset.icon ? (
        <Icon
          className="preset-option-icon"
          icon={preset.icon}
          mode="mask"
          width={16}
          height={16}
        />
      ) : null}
      <span className="preset-option-text">{preset.text}</span>
      <span className="preset-option-gradient" />
    </span>
  )
}
