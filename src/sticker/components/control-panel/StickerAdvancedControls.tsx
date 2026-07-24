import { AdvancedSection } from '../../../shared/components/AdvancedSection'
import { Button } from '../../../shared/ui/button'
import { FieldLabel } from '../../../shared/components/FieldLabel'
import { HdrControls } from '../../../shared/components/HdrControls'
import { SliderField } from '../../../shared/components/SliderField'
import { hasChangedFields } from '../../../shared/utils/controlsDiff'
import {
  DEFAULT_STICKER_CONTROLS,
  STICKER_DEFAULT_OUTLINE_WIDTH,
  type StickerControls,
  type StickerEnvelopeControls,
  type StickerPaddingControls,
} from '../../config/defaults'

// 高级面板关注的字段：任一偏离默认值就默认展开。新增字段只加一行访问器。
const ADVANCED_FIELDS: ReadonlyArray<(c: StickerControls) => unknown> = [
  (c) => c.iconTilt,
  (c) => c.tilt,
  (c) => c.peak,
  (c) => c.flash,
  (c) => c.flashStops,
  (c) => c.antialiasScale,
  (c) => c.envelope.outlineStrokeWidth,
  (c) => c.padding.x,
  (c) => c.padding.y,
  (c) => c.lineHeight,
]

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
  const defaultOutlineWidth = STICKER_DEFAULT_OUTLINE_WIDTH[controls.flavor]
  // 描边默认值随 flavor 变化，构造对应基准后再统一比较。
  const baseline: StickerControls = {
    ...DEFAULT_STICKER_CONTROLS,
    envelope: {
      ...DEFAULT_STICKER_CONTROLS.envelope,
      outlineStrokeWidth: defaultOutlineWidth,
    },
  }
  const hasAdvancedParams = hasChangedFields(controls, baseline, ADVANCED_FIELDS)

  return (
    <AdvancedSection defaultOpen={hasAdvancedParams}>
      <div className="field">
        <FieldLabel
          isDirty={
            controls.iconTilt !== DEFAULT_STICKER_CONTROLS.iconTilt ||
            controls.tilt !== DEFAULT_STICKER_CONTROLS.tilt ||
            controls.peak !== DEFAULT_STICKER_CONTROLS.peak
          }
          onReset={() => {
            updateControl('iconTilt', DEFAULT_STICKER_CONTROLS.iconTilt)
            updateControl('tilt', DEFAULT_STICKER_CONTROLS.tilt)
            updateControl('peak', DEFAULT_STICKER_CONTROLS.peak)
          }}
        >
          变换
        </FieldLabel>
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
        defaultValue={DEFAULT_STICKER_CONTROLS.antialiasScale}
        valueLabel={`${controls.antialiasScale.toFixed(1)}x`}
        onValueChange={(value) => updateControl('antialiasScale', value)}
      />

      <SliderField
        label="描边厚度"
        min={0}
        max={48}
        value={controls.envelope.outlineStrokeWidth}
        defaultValue={STICKER_DEFAULT_OUTLINE_WIDTH[controls.flavor]}
        onValueChange={(value) => updateEnvelope('outlineStrokeWidth', value)}
      />

      <SliderField
        label="左右边距"
        min={0}
        max={120}
        value={controls.padding.x}
        defaultValue={DEFAULT_STICKER_CONTROLS.padding.x}
        onValueChange={(value) => updatePadding('x', value)}
      />

      <SliderField
        label="上下边距"
        min={0}
        max={120}
        value={controls.padding.y}
        defaultValue={DEFAULT_STICKER_CONTROLS.padding.y}
        onValueChange={(value) => updatePadding('y', value)}
      />

      <SliderField
        label="行高"
        min={0.8}
        max={2}
        step={0.05}
        value={controls.lineHeight}
        defaultValue={DEFAULT_STICKER_CONTROLS.lineHeight}
        valueLabel={controls.lineHeight.toFixed(2)}
        onValueChange={(value) => updateControl('lineHeight', value)}
      />
    </AdvancedSection>
  )
}
