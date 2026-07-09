import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  deriveDepthColor,
  randomGradientPair,
  randomVividColors,
} from '../utils/color'
import {
  cancelPendingPreviews,
  exportStickerBlob,
  renderStickerPreview,
  type PreviewResult,
} from '../worker/stickerWorker'
import {
  DEFAULT_STICKER_CONTROLS,
  defaultGradientAngle,
  type StickerControls,
  type StickerEnvelopeControls,
  type StickerPaddingControls,
} from '../config/defaults'
import { STICKER_PRESET_LIST, type StickerPreset } from '../config/presets'
import { controlsToSearch, searchToControls } from '../config/searchParams'

export type CopiedTarget = 'image' | 'link'

function buildShareUrl(controls: StickerControls): string {
  const params = new URLSearchParams(controlsToSearch(controls))
  const query = params.toString()
  return `${location.origin}${location.pathname}${query ? `?${query}` : ''}`
}

function searchKey(search: Record<string, string>): string {
  return Object.entries(search)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

export function useStickerEditor() {
  const search = useSearch({ from: '__root__' })
  const navigate = useNavigate()
  const currentSearchKey = useMemo(() => searchKey(search), [search])
  const lastWrittenSearchKey = useRef(currentSearchKey)

  const [controls, setControls] = useState<StickerControls>(() =>
    searchToControls(search),
  )
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  // 复制反馈：记录刚复制成功的按钮，短暂显示「已复制」。
  const [copied, setCopied] = useState<CopiedTarget | null>(null)
  const [renderControls, setRenderControls] = useState(controls)

  useEffect(() => {
    const timer = setTimeout(() => setRenderControls(controls), 250)
    return () => clearTimeout(timer)
  }, [controls])

  // URL query 发生外部变化（例如浏览器前进/后退）时，回灌到编辑状态。
  useEffect(() => {
    if (currentSearchKey === lastWrittenSearchKey.current) return

    const nextControls = searchToControls(search)
    setControls(nextControls)
    setRenderControls(nextControls)
    lastWrittenSearchKey.current = currentSearchKey
  }, [currentSearchKey, search])

  // 同步控件 → URL query（用 replace，避免刷屏历史记录）。
  useEffect(() => {
    const nextSearch = controlsToSearch(renderControls)
    lastWrittenSearchKey.current = searchKey(nextSearch)
    void navigate({
      to: '.',
      search: () => nextSearch,
      replace: true,
    })
  }, [renderControls, navigate])

  useEffect(() => {
    if (renderControls.text.trim().length === 0) {
      setPreview((prev) => {
        prev?.bitmap.close()
        return null
      })
      setPreviewError(null)
      setIsRendering(false)
      return
    }

    let active = true
    setPreviewError(null)
    setIsRendering(true)

    void renderStickerPreview(renderControls)
      .then((result) => {
        if (active) {
          setPreview((prev) => {
            prev?.bitmap.close()
            return result
          })
          setIsRendering(false)
        } else {
          result.bitmap.close()
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof Error ? error.message : '渲染失败。'
        setPreview((prev) => {
          prev?.bitmap.close()
          return null
        })
        setPreviewError(message)
        setIsRendering(false)
      })

    return () => {
      active = false
      cancelPendingPreviews()
    }
  }, [renderControls])

  const hasText = controls.text.trim().length > 0

  const updateControl = <K extends keyof StickerControls>(
    key: K,
    value: StickerControls[K],
  ) => {
    setControls((c) => ({ ...c, [key]: value }))
  }

  const updateEnvelope = <K extends keyof StickerEnvelopeControls>(
    key: K,
    value: StickerEnvelopeControls[K],
  ) => {
    setControls((c) => ({ ...c, envelope: { ...c.envelope, [key]: value } }))
  }

  const updatePadding = <K extends keyof StickerPaddingControls>(
    key: K,
    value: StickerPaddingControls[K],
  ) => {
    setControls((c) => ({ ...c, padding: { ...c.padding, [key]: value } }))
  }

  const randomizeColors = () => {
    setControls((c) => ({
      ...c,
      envelope: c.flavor === 'bs'
        ? {
            ...c.envelope,
            colors: randomGradientPair(
              c.envelope.colors[0] ?? '#76baf4',
            ),
            gradientAngle: defaultGradientAngle(c.icon),
          }
        : {
            ...c.envelope,
            colors: randomVividColors(c.envelope.colors[0] ?? '#76baf4'),
            gradientAngle: defaultGradientAngle(c.icon),
          },
    }))
  }

  const updateColorAt = (index: number, value: string) => {
    setControls((c) => {
      const colors = [...c.envelope.colors]
      colors[index] = value
      return { ...c, envelope: { ...c.envelope, colors } }
    })
  }

  const addColor = (at?: number) => {
    setControls((c) => {
      if (c.envelope.colors.length >= 3) return c
      const colors = [...c.envelope.colors]
      const index = at ?? colors.length
      // 新增色以相邻色块派生的深色作为初值，避免凭空插入突兀颜色。
      const seed = colors[index - 1] ?? colors[index] ?? '#76baf4'
      colors.splice(index, 0, deriveDepthColor(seed))
      return { ...c, envelope: { ...c.envelope, colors } }
    })
  }

  const removeColor = (index: number) => {
    setControls((c) => {
      if (c.envelope.colors.length <= 1) return c
      const colors = c.envelope.colors.filter((_, i) => i !== index)
      return { ...c, envelope: { ...c.envelope, colors } }
    })
  }

  const applyPreset = (preset: StickerPreset) => {
    setControls((c) => ({
      ...c,
      text: preset.text,
      flavor: preset.flavor ?? DEFAULT_STICKER_CONTROLS.flavor,
      icon: preset.icon ?? DEFAULT_STICKER_CONTROLS.icon,
      iconTilt: preset.iconTilt ?? DEFAULT_STICKER_CONTROLS.iconTilt,
      envelope: {
        ...c.envelope,
        colors: preset.colors,
        gradientAngle:
          preset.gradientAngle ?? DEFAULT_STICKER_CONTROLS.envelope.gradientAngle,
      },
    }))
  }

  const applyPresetText = (value: string) => {
    const preset = STICKER_PRESET_LIST.find((p) => p.text === value)
    if (preset) applyPreset(preset)
  }

  const handleExport = async () => {
    if (!hasText) return
    setIsExporting(true)
    try {
      const blob = await exportStickerBlob(controls)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sticker.png'
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
      const blob = await exportStickerBlob(controls)
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('clipboard-unavailable')
      }
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      flashCopied('image')
    } catch {
      // iframe / 权限策略 / 无焦点等场景下剪贴板写入会被拒绝，引导用户手动复制。
      setPreviewError('无法直接复制（当前环境限制剪贴板）。请在预览图上右键选择「复制图片」。')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(controls))
      flashCopied('link')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '复制链接失败。'
      setPreviewError(message)
    }
  }

  return {
    controls,
    preview,
    previewError,
    isExporting,
    isRendering,
    copied,
    hasText,
    shareUrl: buildShareUrl(controls),
    updateControl,
    updateEnvelope,
    updatePadding,
    randomizeColors,
    updateColorAt,
    addColor,
    removeColor,
    applyPresetText,
    handleExport,
    handleCopyImage,
    handleCopyLink,
  }
}
