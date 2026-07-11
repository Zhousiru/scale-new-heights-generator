import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  controlsToSearch,
  searchToControls,
} from '../config/searchParams'
import type { AvatarControls } from '../config/defaults'
import {
  cancelPendingAvatarPreviews,
  exportAvatarBlob,
  renderAvatarPreview,
} from '../worker/avatarWorker'
import { generatedFileName } from '../../shared/utils/fileName'
import { useRenderedPreview } from '../../shared/hooks/useRenderedPreview'
import { saveToolSearch, searchRecordKey, toolUrl } from '../../shared/utils/tool'

export type CopiedTarget = 'image' | 'link'

/** 简易模式 URL 参数名 */
const SIMPLE_MODE_PARAM = 'm'
/** 简易模式 URL 参数值 */
const SIMPLE_MODE_VALUE = 'simple'

function buildAvatarUrl(controls: AvatarControls, simpleMode = false): string {
  const search = controlsToSearch(controls)
  if (simpleMode) search[SIMPLE_MODE_PARAM] = SIMPLE_MODE_VALUE
  return toolUrl('avatar', search)
}

export function useAvatarEditor() {
  const search = useSearch({ from: '__root__' })
  const navigate = useNavigate()
  const isSimpleMode = search[SIMPLE_MODE_PARAM] === SIMPLE_MODE_VALUE
  const currentSearchKey = useMemo(() => searchRecordKey(search), [search])
  const lastWrittenSearchKey = useRef(currentSearchKey)

  const [controls, setControls] = useState<AvatarControls>(() =>
    searchToControls(search),
  )
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState<CopiedTarget | null>(null)
  const {
    renderControls,
    setRenderControls,
    preview,
    previewError,
    setPreviewError,
    isRendering,
  } = useRenderedPreview({
    controls,
    delayMs: 180,
    hasContent: hasAvatarContent,
    render: renderAvatarPreview,
    cancel: cancelPendingAvatarPreviews,
  })

  useEffect(() => {
    saveToolSearch('avatar', controlsToSearch(controls))
  }, [controls])

  useEffect(() => {
    if (currentSearchKey === lastWrittenSearchKey.current) return
    const nextControls = searchToControls(search)
    setControls(nextControls)
    setRenderControls(nextControls)
    lastWrittenSearchKey.current = currentSearchKey
  }, [currentSearchKey, search, setRenderControls])

  useEffect(() => {
    const nextSearch = controlsToSearch(renderControls)
    if (isSimpleMode) nextSearch[SIMPLE_MODE_PARAM] = SIMPLE_MODE_VALUE
    lastWrittenSearchKey.current = searchRecordKey(nextSearch)
    void navigate({
      to: '.',
      search: () => nextSearch,
      replace: true,
    })
  }, [renderControls, isSimpleMode, navigate])

  const hasText = hasAvatarText(controls.text)

  const updateControl = <K extends keyof AvatarControls>(
    key: K,
    value: AvatarControls[K],
  ) => {
    setControls((current) => {
      if (key !== 'flash') return { ...current, [key]: value }
      return { ...current, flash: Boolean(value) }
    })
  }

  const handleExport = async () => {
    if (!hasText) return
    setIsExporting(true)
    try {
      const result = await exportAvatarBlob(controls)
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = generatedFileName('avatar', controls.text, result.extension)
      a.click()
      URL.revokeObjectURL(url)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '导出失败。'
      setPreviewError(message)
    } finally {
      setIsExporting(false)
    }
  }

  const flashCopied = (which: CopiedTarget) => {
    setCopied(which)
    setTimeout(() => setCopied((prev) => (prev === which ? null : prev)), 1500)
  }

  const handleCopyImage = async () => {
    if (!hasText) return
    try {
      const result = await exportAvatarBlob(controls)
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('clipboard-unavailable')
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [result.mime]: result.blob }),
      ])
      flashCopied('image')
    } catch {
      setPreviewError('无法直接复制（当前环境限制剪贴板）。请在预览图上右键选择「复制图片」。')
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(buildAvatarUrl(controls, true))
    flashCopied('link')
  }

  return {
    controls,
    preview,
    previewError,
    isRendering,
    isExporting,
    copied,
    hasText,
    isSimpleMode,
    shareUrl: buildAvatarUrl(controls, true),
    editorUrl: buildAvatarUrl(controls),
    updateControl,
    handleExport,
    handleCopyImage,
    handleCopyLink,
    exportLabel: controls.flash ? '导出 HDR 图' : '导出 PNG',
  }
}

function hasAvatarText(text: string): boolean {
  return text.replace(/\r\n|\r|\n/g, '').length > 0
}

function hasAvatarContent(controls: AvatarControls): boolean {
  return hasAvatarText(controls.text)
}
