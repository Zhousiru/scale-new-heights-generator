import { Icon } from '@iconify/react'
import type { ReactNode } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible'

interface AdvancedSectionProps {
  children: ReactNode
  title?: ReactNode
}

export function AdvancedSection({
  children,
  title = '高级设置',
}: AdvancedSectionProps) {
  return (
    <Collapsible className="advanced">
      <CollapsibleTrigger className="advanced-summary">
        <Icon
          className="advanced-summary-icon"
          icon="tabler:chevron-right"
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <form
          className="advanced-body"
          onSubmit={(event) => event.preventDefault()}
        >
          {children}
        </form>
      </CollapsibleContent>
    </Collapsible>
  )
}
