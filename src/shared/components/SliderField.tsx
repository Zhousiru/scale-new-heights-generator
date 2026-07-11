import type { ReactNode } from 'react'
import { Slider } from '../ui/slider'
import { cn } from '../utils/cn'
import { FieldLabel } from './FieldLabel'

interface SliderFieldProps {
  className?: string
  label: ReactNode
  max: number
  min: number
  step?: number
  value: number
  defaultValue?: number
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
  defaultValue,
  valueLabel = value,
  onValueChange,
}: SliderFieldProps) {
  const isDirty = defaultValue !== undefined && value !== defaultValue
  const handleReset = () => {
    if (defaultValue !== undefined) {
      onValueChange(defaultValue)
    }
  }

  return (
    <div className={cn('field field-slider', className)}>
      <FieldLabel isDirty={isDirty} onReset={handleReset}>
        {label}
      </FieldLabel>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onValueChange}
      />
      <span className="field-value">{valueLabel}</span>
    </div>
  )
}
