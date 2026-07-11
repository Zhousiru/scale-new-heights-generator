import { Icon } from '@iconify/react'
import { loadToolSearch, toolUrl, type Tool } from '../utils/tool'

interface ToolFooterProps {
  tool: Tool
  icon: string
  label: string
  showIntranetLink?: boolean
}

export function ToolFooter({
  tool,
  icon,
  label,
  showIntranetLink = false,
}: ToolFooterProps) {
  return (
    <div className="footer-links">
      <a className="footer-link" href={toolUrl(tool, loadToolSearch(tool))}>
        <Icon icon={icon} />
        {label}
      </a>
      {showIntranetLink && (
        <a
          className="footer-link"
          href="http://go/^"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon icon="tabler:book" />
          内网文档
        </a>
      )}
      <a
        className="footer-link"
        href="https://github.com/zhousiru/scale-new-heights-generator"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon="tabler:brand-github" />
        GitHub
      </a>
    </div>
  )
}
