import { Icon } from '@iconify/react'
import { Link } from '@tanstack/react-router'

interface ToolFooterProps {
  to: '/' | '/avatar'
  icon: string
  label: string
  search: Record<string, string>
}

export function ToolFooter({
  to,
  icon,
  label,
  search,
}: ToolFooterProps) {
  return (
    <div className="footer-links">
      <Link className="footer-link" to={to} search={search}>
        <Icon icon={icon} width={16} height={16} />
        {label}
      </Link>
      <a
        className="footer-link"
        href="http://go/^"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon="tabler:book" width={16} height={16} />
        内网文档
      </a>
      <a
        className="footer-link"
        href="https://github.com/zhousiru/scale-new-heights-generator"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon="tabler:brand-github" width={16} height={16} />
        GitHub
      </a>
    </div>
  )
}
