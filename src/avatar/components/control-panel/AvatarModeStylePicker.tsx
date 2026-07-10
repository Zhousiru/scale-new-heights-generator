import { Icon } from '@iconify/react'
import type { CSSProperties } from 'react'
import { Button } from '../../../shared/ui/button'
import { Select } from '../../../shared/ui/select'
import type {
  AvatarControls,
  AvatarMode,
} from '../../config/defaults'
import {
  AVATAR_STYLES,
  AVATAR_STYLE_LIST,
  type AvatarStyle,
  type AvatarStylePreset,
} from '../../config/styles'

interface AvatarModeStylePickerProps {
  mode: AvatarControls['mode']
  style: AvatarControls['style']
  onModeChange: (value: AvatarControls['mode']) => void
  onStyleChange: (value: AvatarControls['style']) => void
}

const MODE_OPTIONS: {
  id: AvatarMode
  label: string
}[] = [
  {
    id: 'fill',
    label: '彩底白字',
  },
  {
    id: 'outline',
    label: '彩环同色字',
  },
]

export function AvatarModeStylePicker({
  mode,
  style,
  onModeChange,
  onStyleChange,
}: AvatarModeStylePickerProps) {
  const activeStyle = AVATAR_STYLES[style]

  return (
    <div className="avatar-mode-list">
      {MODE_OPTIONS.map((option) => (
        <div
          key={option.id}
          className={`avatar-mode-item${mode === option.id ? ' is-active' : ''}`}
        >
          <Button
            className="avatar-mode-main"
            variant="secondary"
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => onModeChange(option.id)}
          >
            <AvatarModePreview mode={option.id} style={activeStyle} />
            <span className="avatar-mode-copy">
              <span>{option.label}</span>
            </span>
          </Button>

          <Select
            className="avatar-mode-more"
            contentClassName="avatar-mode-menu"
            viewportClassName="avatar-mode-menu-viewport"
            itemClassName="avatar-style-option"
            value={style}
            unstyledTrigger
            hideIndicator
            align="start"
            sideOffset={6}
            trigger={<Icon icon="tabler:chevron-down" />}
            triggerLabel={`${option.label}更多样式`}
            triggerTitle="更多样式"
            options={AVATAR_STYLE_LIST.map((styleOption) => ({
              value: styleOption.id,
              label: (
                <span className="avatar-style-option-content">
                  <AvatarModePreview mode={option.id} style={styleOption} />
                  <span>{styleOption.label}</span>
                </span>
              ),
            }))}
            onOpenChange={(open) => {
              if (open) onModeChange(option.id)
            }}
            onValueChange={(value) => {
              onModeChange(option.id)
              onStyleChange(value as AvatarStyle)
            }}
          />
        </div>
      ))}
    </div>
  )
}

function AvatarModePreview({
  mode,
  style,
}: {
  mode: AvatarMode
  style: AvatarStylePreset
}) {
  return (
    <span
      className={`avatar-mode-preview avatar-mode-preview-${mode}`}
      style={{
        '--avatar-preview-gradient': `linear-gradient(${style.gradientAngle ?? 135}deg, ${style.stops[0].srgb}, ${style.stops[1].srgb})`,
        '--avatar-preview-solid': style.solid,
      } as CSSProperties}
      aria-hidden="true"
    >
      群
    </span>
  )
}
