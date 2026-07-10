import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import type { StickerControls } from '../../config/defaults'

interface StickerIconFieldProps {
  icon: string
  updateControl: <K extends keyof StickerControls>(
    key: K,
    value: StickerControls[K],
  ) => void
}

export function StickerIconField({
  icon,
  updateControl,
}: StickerIconFieldProps) {
  return (
    <label className="field icon-field">
      <span className="field-label">前缀图标</span>
      <div className="icon-input-wrap">
        <Input
          className="icon-input"
          type="text"
          value={icon}
          placeholder="例如 mdi:rocket"
          onChange={(e) => updateControl('icon', e.target.value)}
        />
        {icon.length > 0 && (
          <Button
            className="icon-clear"
            variant="ghost"
            size="icon"
            type="button"
            title="清空图标"
            onClick={() => updateControl('icon', '')}
          >
            ×
          </Button>
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
  )
}
