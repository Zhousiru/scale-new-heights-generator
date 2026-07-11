import { Icon } from '@iconify/react'
import { Button } from '../ui/button'

interface SimpleEditFooterProps {
  editorUrl: string
}

export function SimpleEditFooter({ editorUrl }: SimpleEditFooterProps) {
  return (
    <div className="simple-footer">
      <Button variant="secondary" asChild>
        <a href={editorUrl} target="_top">
          <Icon icon="tabler:edit" />
          编辑
        </a>
      </Button>
    </div>
  )
}
