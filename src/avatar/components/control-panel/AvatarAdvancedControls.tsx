import { HdrControls } from '../../../shared/components/HdrControls'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../shared/ui/collapsible'
import { Slider } from '../../../shared/ui/slider'
import {
  AVATAR_SIZE_MAX,
  AVATAR_SIZE_MIN,
  type AvatarControls,
} from '../../config/defaults'

interface AvatarAdvancedControlsProps {
  controls: AvatarControls
  updateControl: <K extends keyof AvatarControls>(
    key: K,
    value: AvatarControls[K],
  ) => void
}

export function AvatarAdvancedControls({
  controls,
  updateControl,
}: AvatarAdvancedControlsProps) {
  return (
    <Collapsible className="advanced">
      <CollapsibleTrigger className="advanced-summary">高级设置</CollapsibleTrigger>
      <CollapsibleContent asChild>
        <form
          className="advanced-body"
          onSubmit={(event) => event.preventDefault()}
        >
          <HdrControls
            flashStops={controls.flash ? controls.flashStops : 0}
            fieldClassName="field avatar-field field-slider"
            onFlashStopsChange={(value) => {
              updateControl('flashStops', value)
              updateControl('flash', value > 0)
            }}
          />

          <div className="field avatar-field field-slider">
            <span className="field-label">尺寸</span>
            <Slider
              min={AVATAR_SIZE_MIN}
              max={AVATAR_SIZE_MAX}
              step={64}
              value={controls.size}
              onValueChange={(value) => updateControl('size', value)}
            />
            <span className="field-value">{controls.size}</span>
          </div>

          <div className="field avatar-field field-slider">
            <span className="field-label">抗锯齿</span>
            <Slider
              min={1}
              max={5}
              step={0.5}
              value={controls.antialiasScale}
              onValueChange={(value) => updateControl('antialiasScale', value)}
            />
            <span className="field-value">{controls.antialiasScale}x</span>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
