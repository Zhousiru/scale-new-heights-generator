import { AdvancedSection } from '../../../shared/components/AdvancedSection'
import { Button } from '../../../shared/ui/button'
import { HdrControls } from '../../../shared/components/HdrControls'
import { SliderField } from '../../../shared/components/SliderField'
import type {
  StickerControls,
  StickerEnvelopeControls,
  StickerPaddingControls,
} from '../../config/defaults'

interface StickerAdvancedControlsProps {
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
}

export function StickerAdvancedControls({
  controls,
  updateControl,
  updateEnvelope,
  updatePadding,
}: StickerAdvancedControlsProps) {
  return (
    <AdvancedSection>
      <div className="field">
        <span className="field-label">变换</span>
        <div className="toggle-group">
          <Button
            className="peak-toggle"
            variant="secondary"
            size="sm"
            active={controls.iconTilt}
            type="button"
            aria-pressed={controls.iconTilt}
            title="图标倾斜（开启时前缀图标跟随字面旋转/斜切）"
            onClick={() => updateControl('iconTilt', !controls.iconTilt)}
          >
            {controls.iconTilt ? '图标倾斜' : '图标直立'}
          </Button>
          <Button
            className="peak-toggle"
            variant="secondary"
            size="sm"
            active={controls.tilt}
            type="button"
            aria-pressed={controls.tilt}
            title="文本倾斜（开启应用字面固有的旋转/斜切，关闭则文字直立）"
            onClick={() => updateControl('tilt', !controls.tilt)}
          >
            {controls.tilt ? '文本倾斜' : '文本直立'}
          </Button>
          <Button
            className="peak-toggle"
            variant="secondary"
            size="sm"
            active={controls.peak}
            type="button"
            aria-pressed={controls.peak}
            title="错位攀登（开启为高低错落效果，关闭则对齐平铺）"
            onClick={() => updateControl('peak', !controls.peak)}
          >
            {controls.peak ? '错位攀登' : '对齐平铺'}
          </Button>
        </div>
      </div>

      <HdrControls
        flashStops={controls.flash ? controls.flashStops : 0}
        fieldClassName="field field-slider"
        onFlashStopsChange={(value) => {
          updateControl('flashStops', value)
          updateControl('flash', value > 0)
        }}
      />

      <SliderField
        label="抗锯齿"
        min={1}
        max={5}
        step={0.1}
        value={controls.antialiasScale}
        valueLabel={`${controls.antialiasScale.toFixed(1)}x`}
        onValueChange={(value) => updateControl('antialiasScale', value)}
      />

      <SliderField
        label="描边厚度"
        min={0}
        max={48}
        value={controls.envelope.outlineStrokeWidth}
        onValueChange={(value) => updateEnvelope('outlineStrokeWidth', value)}
      />

      <SliderField
        label="左右边距"
        min={0}
        max={120}
        value={controls.padding.x}
        onValueChange={(value) => updatePadding('x', value)}
      />

      <SliderField
        label="上下边距"
        min={0}
        max={120}
        value={controls.padding.y}
        onValueChange={(value) => updatePadding('y', value)}
      />

      <SliderField
        label="行高"
        min={0.8}
        max={2}
        step={0.05}
        value={controls.lineHeight}
        valueLabel={controls.lineHeight.toFixed(2)}
        onValueChange={(value) => updateControl('lineHeight', value)}
      />
    </AdvancedSection>
  )
}
