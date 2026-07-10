import * as SliderPrimitive from '@radix-ui/react-slider'
import type { ComponentProps } from 'react'
import { cn } from '../utils/cn'

interface SliderProps
  extends Omit<ComponentProps<typeof SliderPrimitive.Root>, 'value' | 'onValueChange'> {
  value: number
  onValueChange: (value: number) => void
}

export function Slider({
  className,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('ui-slider', className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next)
      }}
      {...props}
    >
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-slider-thumb" />
    </SliderPrimitive.Root>
  )
}
