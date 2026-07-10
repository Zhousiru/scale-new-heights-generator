import { Button } from '../../../shared/ui/button'
import { HdrControls } from '../../../shared/components/HdrControls'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../shared/ui/collapsible'
import { Slider } from '../../../shared/ui/slider'
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
    <Collapsible className="advanced">
      <CollapsibleTrigger className="advanced-summary">高级设置</CollapsibleTrigger>
      <CollapsibleContent asChild>
        <form
          className="advanced-body"
          onSubmit={(event) => event.preventDefault()}
        >
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

          <label className="field field-slider">
            <span className="field-label">抗锯齿</span>
            <Slider
              min={1}
              max={5}
              step={0.1}
              value={controls.antialiasScale}
              onValueChange={(value) => updateControl('antialiasScale', value)}
            />
            <span className="field-value">{controls.antialiasScale.toFixed(1)}x</span>
          </label>

          <label className="field field-slider">
            <span className="field-label">描边厚度</span>
            <Slider
              min={0}
              max={48}
              value={controls.envelope.outlineStrokeWidth}
              onValueChange={(value) => updateEnvelope('outlineStrokeWidth', value)}
            />
            <span className="field-value">
              {controls.envelope.outlineStrokeWidth}
            </span>
          </label>

          <label className="field field-slider">
            <span className="field-label">左右边距</span>
            <Slider
              min={0}
              max={120}
              value={controls.padding.x}
              onValueChange={(value) => updatePadding('x', value)}
            />
            <span className="field-value">{controls.padding.x}</span>
          </label>

          <label className="field field-slider">
            <span className="field-label">上下边距</span>
            <Slider
              min={0}
              max={120}
              value={controls.padding.y}
              onValueChange={(value) => updatePadding('y', value)}
            />
            <span className="field-value">{controls.padding.y}</span>
          </label>

          <label className="field field-slider">
            <span className="field-label">行高</span>
            <Slider
              min={0.8}
              max={2}
              step={0.05}
              value={controls.lineHeight}
              onValueChange={(value) => updateControl('lineHeight', value)}
            />
            <span className="field-value">{controls.lineHeight.toFixed(2)}</span>
          </label>
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
