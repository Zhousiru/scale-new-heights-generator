import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps } from 'react'
import { cn } from '../utils/cn'

/** Dialog 根组件 */
export const Dialog = DialogPrimitive.Root
/** Dialog 触发器组件 */
export const DialogTrigger = DialogPrimitive.Trigger
/** Dialog 关闭按钮组件 */
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog-overlay" />
      <DialogPrimitive.Content
        className={cn('ui-dialog-content', className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('ui-dialog-title', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('ui-dialog-description', className)}
      {...props}
    />
  )
}

export function DialogFooter({
  className,
  ...props
}: ComponentProps<'div'>) {
  return <div className={cn('ui-dialog-footer', className)} {...props} />
}
