import { useLayoutEffect, useRef } from 'react'
import { Textarea } from '../../shared/ui/input'
import type {
  StickerControls,
  StickerEnvelopeControls,
  StickerFlavor,
  StickerPaddingControls,
} from '../config/defaults'
import { StickerAdvancedControls } from './control-panel/StickerAdvancedControls'
import { StickerIconField } from './control-panel/StickerIconField'
import { StickerPresetToolbar } from './control-panel/StickerPresetToolbar'
import { StickerStyleField } from './control-panel/StickerStyleField'

interface StickerControlsPanelProps {
  controls: StickerControls
  updateControl: <K extends keyof StickerControls>(
    key: K,
    value: StickerControls[K],
  ) => void
  updateFlavor: (flavor: StickerFlavor) => void
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
  updateFlavor,
  updateEnvelope,
  updatePadding,
  randomizeColors,
  updateColorAt,
  addColor,
  removeColor,
  applyPresetText,
}: StickerControlsPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [controls.text])

  return (
    <section className="panel panel-controls">
      <Textarea
        ref={textareaRef}
        className="text-input"
        value={controls.text}
        placeholder="输入文本，回车换行"
        rows={2}
        onChange={(e) => updateControl('text', e.target.value)}
      />

      <StickerPresetToolbar
        controls={controls}
        updateEnvelope={updateEnvelope}
        randomizeColors={randomizeColors}
        updateColorAt={updateColorAt}
        addColor={addColor}
        removeColor={removeColor}
        applyPresetText={applyPresetText}
      />

      <StickerStyleField
        flavor={controls.flavor}
        updateFlavor={updateFlavor}
      />

      <StickerIconField
        icon={controls.icon}
        updateControl={updateControl}
      />

      <StickerAdvancedControls
        controls={controls}
        updateControl={updateControl}
        updateEnvelope={updateEnvelope}
        updatePadding={updatePadding}
      />
    </section>
  )
}
