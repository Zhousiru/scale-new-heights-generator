import * as SelectPrimitive from '@radix-ui/react-select'
import { Icon } from '@iconify/react'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
  color?: string
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface SelectProps {
  value: string
  placeholder?: string
  options?: SelectOption[]
  groups?: SelectGroup[]
  className?: string
  contentClassName?: string
  viewportClassName?: string
  itemClassName?: string
  trigger?: ReactNode
  triggerLabel?: string
  triggerTitle?: string
  unstyledTrigger?: boolean
  hideIndicator?: boolean
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  collisionPadding?: number
  onOpenChange?: (open: boolean) => void
  onValueChange: (value: string) => void
}

export function Select({
  value,
  placeholder,
  options,
  groups,
  className,
  contentClassName,
  viewportClassName,
  itemClassName,
  trigger,
  triggerLabel,
  triggerTitle,
  unstyledTrigger,
  hideIndicator,
  align,
  sideOffset,
  collisionPadding = 8,
  onOpenChange,
  onValueChange,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
    >
      <SelectPrimitive.Trigger
        className={cn(!unstyledTrigger && 'ui-select-trigger', className)}
        aria-label={triggerLabel}
        title={triggerTitle}
      >
        {trigger ?? (
          <>
            <SelectPrimitive.Value
              className="ui-select-value"
              placeholder={placeholder}
            />
            <SelectPrimitive.Icon asChild>
              <Icon icon="tabler:chevron-down" />
            </SelectPrimitive.Icon>
          </>
        )}
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn('ui-select-content', contentClassName)}
          position="popper"
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
        >
          <SelectPrimitive.Viewport className={cn('ui-select-viewport', viewportClassName)}>
            {groups
              ? groups.map((group) => (
                  <SelectPrimitive.Group key={group.label}>
                    <SelectPrimitive.Label className="ui-select-label">
                      {group.label}
                    </SelectPrimitive.Label>
                    {group.options.map((option) => (
                      <SelectItem
                        key={option.value}
                        option={option}
                        className={itemClassName}
                        hideIndicator={hideIndicator}
                      />
                    ))}
                  </SelectPrimitive.Group>
                ))
              : options?.map((option) => (
                  <SelectItem
                    key={option.value}
                    option={option}
                    className={itemClassName}
                    hideIndicator={hideIndicator}
                  />
                ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

function SelectItem({
  option,
  className,
  hideIndicator,
}: {
  option: SelectOption
  className?: string
  hideIndicator?: boolean
}) {
  return (
    <SelectPrimitive.Item
      className={cn('ui-select-item', className)}
      value={option.value}
      disabled={option.disabled}
      style={{ color: option.color }}
    >
      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      {hideIndicator ? null : (
        <SelectPrimitive.ItemIndicator className="ui-select-indicator">
          <Icon icon="tabler:check" />
        </SelectPrimitive.ItemIndicator>
      )}
    </SelectPrimitive.Item>
  )
}
