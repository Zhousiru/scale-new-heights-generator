import { Slider } from '../ui/slider'
import { Button } from '../ui/button'
import {
  DEFAULT_FLASH_STOPS,
  FLASH_STOPS_MAX,
  FLASH_STOPS_MIN,
  FLASH_STOPS_STEP,
} from '../config/hdr'

interface HdrControlsProps {
  flashStops: number
  label?: string
  fieldClassName?: string
  onFlashStopsChange: (value: number) => void
}

export function HdrControls({
  flashStops,
  label = 'HDR 高亮',
  fieldClassName = 'field',
  onFlashStopsChange,
}: HdrControlsProps) {
  const enable = () => {
    const accepted = window.confirm(
      'HDR 高亮会让图片在支持的屏幕上明显变亮。提醒：不要高频发送打扰他人；日常建议控制在 +1 EV 以内。',
    )
    if (accepted) onFlashStopsChange(DEFAULT_FLASH_STOPS)
  }

  if (flashStops === 0) {
    return (
      <div className={fieldClassName}>
        <span className="field-label">{label}</span>
        <Button
          className="field-action"
          variant="secondary"
          size="sm"
          type="button"
          onClick={enable}
        >
          开启 HDR 高亮
        </Button>
      </div>
    )
  }

  return (
    <div className={fieldClassName}>
      <span className="field-label">{label}</span>
      <Slider
        min={FLASH_STOPS_MIN}
        max={FLASH_STOPS_MAX}
        step={FLASH_STOPS_STEP}
        value={flashStops}
        onValueChange={onFlashStopsChange}
      />
      <span className="field-value">{formatEv(flashStops)}</span>
    </div>
  )
}

function formatEv(value: number): string {
  return `+${Number(value.toFixed(2))} EV`
}
