import type { ComponentProps } from 'react'
import { cn } from '../utils/cn'

export function Input({
  className,
  ...props
}: ComponentProps<'input'>) {
  return <input className={cn('ui-input', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: ComponentProps<'textarea'>) {
  return <textarea className={cn('ui-textarea', className)} {...props} />
}
