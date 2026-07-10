import { useLayoutEffect, useRef } from 'react'
import { AngleKnob } from '../../shared/components/AngleKnob'
import { Textarea } from '../../shared/ui/input'
import {
  DEFAULT_AVATAR_CONTROLS,
  type AvatarControls,
} from '../config/defaults'
import { AVATAR_STYLES } from '../config/styles'
import { AvatarAdvancedControls } from './control-panel/AvatarAdvancedControls'
import { AvatarModeStylePicker } from './control-panel/AvatarModeStylePicker'

interface AvatarControlsPanelProps {
  controls: AvatarControls
  updateControl: <K extends keyof AvatarControls>(
    key: K,
    value: AvatarControls[K],
  ) => void
}

export function AvatarControlsPanel({
  controls,
  updateControl,
}: AvatarControlsPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [controls.text])

  const applyStyleAngle = (style: AvatarControls['style']) => {
    updateControl(
      'gradientAngle',
      AVATAR_STYLES[style].gradientAngle ?? DEFAULT_AVATAR_CONTROLS.gradientAngle,
    )
  }

  return (
    <section className="panel panel-controls">
      <Textarea
        ref={textareaRef}
        className="text-input"
        value={controls.text}
        placeholder="输入群名"
        rows={2}
        onChange={(event) => updateControl('text', event.target.value)}
      />

      <div className="field avatar-field">
        <span className="field-label">模式</span>
        <AvatarModeStylePicker
          mode={controls.mode}
          style={controls.style}
          onModeChange={(mode) => {
            updateControl('mode', mode)
            if (mode === 'fill') applyStyleAngle(controls.style)
          }}
          onStyleChange={(style) => {
            updateControl('style', style)
            applyStyleAngle(style)
          }}
        />
      </div>

      <div
        className={`field avatar-field avatar-rotation-field${controls.mode === 'fill' ? ' has-gradient' : ''}`}
      >
        <span className="rotation-control">
          <span className="field-label">文字旋转</span>
          <AngleKnob
            label="文字旋转"
            signed
            value={controls.rotation}
            onChange={(value) => updateControl('rotation', value)}
          />
        </span>
        {controls.mode === 'fill' && (
          <span className="rotation-control">
            <span className="field-label">背景角度</span>
            <AngleKnob
              label="背景角度"
              value={controls.gradientAngle}
              onChange={(value) => updateControl('gradientAngle', value)}
            />
          </span>
        )}
      </div>

      <AvatarAdvancedControls
        controls={controls}
        updateControl={updateControl}
      />
    </section>
  )
}
