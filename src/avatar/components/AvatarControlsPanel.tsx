import { useLayoutEffect, useRef } from 'react'
import { AngleKnob } from '../../shared/components/AngleKnob'
import { FieldLabel } from '../../shared/components/FieldLabel'
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
        <FieldLabel
          isDirty={controls.mode !== DEFAULT_AVATAR_CONTROLS.mode || controls.style !== DEFAULT_AVATAR_CONTROLS.style}
          onReset={() => {
            updateControl('mode', DEFAULT_AVATAR_CONTROLS.mode)
            updateControl('style', DEFAULT_AVATAR_CONTROLS.style)
            applyStyleAngle(DEFAULT_AVATAR_CONTROLS.style)
          }}
        >
          模式
        </FieldLabel>
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
          <FieldLabel
            isDirty={controls.rotation !== DEFAULT_AVATAR_CONTROLS.rotation}
            onReset={() => updateControl('rotation', DEFAULT_AVATAR_CONTROLS.rotation)}
          >
            文字旋转
          </FieldLabel>
          <AngleKnob
            label="文字旋转"
            signed
            value={controls.rotation}
            defaultValue={DEFAULT_AVATAR_CONTROLS.rotation}
            onChange={(value) => updateControl('rotation', value)}
          />
        </span>
        {controls.mode === 'fill' && (
          <span className="rotation-control">
            <FieldLabel
              isDirty={
                controls.gradientAngle !==
                (AVATAR_STYLES[controls.style].gradientAngle ??
                  DEFAULT_AVATAR_CONTROLS.gradientAngle)
              }
              onReset={() =>
                updateControl(
                  'gradientAngle',
                  AVATAR_STYLES[controls.style].gradientAngle ??
                    DEFAULT_AVATAR_CONTROLS.gradientAngle,
                )
              }
            >
              背景角度
            </FieldLabel>
            <AngleKnob
              label="背景角度"
              value={controls.gradientAngle}
              defaultValue={
                AVATAR_STYLES[controls.style].gradientAngle ??
                DEFAULT_AVATAR_CONTROLS.gradientAngle
              }
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
