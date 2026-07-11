import { Icon } from '@iconify/react'
import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

interface FieldLabelProps {
  className?: string
  children: ReactNode
  isDirty?: boolean
  onReset?: () => void
}

export function FieldLabel({ className, children, isDirty, onReset }: FieldLabelProps) {
  return (
    <span className={cn('field-label', className, isDirty && 'is-dirty')}>
      <span className="field-label-text" onDoubleClick={onReset} title={isDirty ? '双击重置' : undefined}>
        {children}
      </span>
      {isDirty && onReset && (
        <button
          type="button"
          className="field-reset"
          onClick={onReset}
          title="重置"
          aria-label="重置"
        >
          <Icon icon="tabler:restore" />
        </button>
      )}
    </span>
  )
}