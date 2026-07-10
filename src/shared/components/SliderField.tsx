import type { ReactNode } from 'react'
import { Slider } from '../ui/slider'
import { cn } from '../utils/cn'

interface SliderFieldProps {
  className?: string
  label: ReactNode
  max: number
  min: number
  step?: number
  value: number
  valueLabel?: ReactNode
  onValueChange: (value: number) => void
}

export function SliderField({
  className,
  label,
  max,
  min,
  step,
  value,
  valueLabel = value,
  onValueChange,
}: SliderFieldProps) {
  return (
    <label className={cn('field field-slider', className)}>
      <span className="field-label">{label}</span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
      />
      <span className="field-value">{valueLabel}</span>
    </label>
  )
}
