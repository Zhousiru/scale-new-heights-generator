import { useEffect, useState } from 'react'
import {
  disposePreview,
  type PreviewResult,
} from '../components/ImagePreview'

interface UseRenderedPreviewOptions<T> {
  controls: T
  delayMs: number
  hasContent: (controls: T) => boolean
  render: (controls: T) => Promise<PreviewResult>
  cancel: () => void
}

export function useRenderedPreview<T>({
  controls,
  delayMs,
  hasContent,
  render,
  cancel,
}: UseRenderedPreviewOptions<T>) {
  const [renderControls, setRenderControls] = useState(controls)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setRenderControls(controls), delayMs)
    return () => clearTimeout(timer)
  }, [controls, delayMs])

  useEffect(() => {
    if (!hasContent(renderControls)) {
      setPreview((prev) => {
        disposePreview(prev)
        return null
      })
      setPreviewError(null)
      setIsRendering(false)
      return
    }

    let active = true
    setPreviewError(null)
    setIsRendering(true)

    void render(renderControls)
      .then((result) => {
        if (active) {
          setPreview((prev) => {
            disposePreview(prev)
            return result
          })
          setIsRendering(false)
        } else {
          disposePreview(result)
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof Error ? error.message : '渲染失败。'
        setPreview((prev) => {
          disposePreview(prev)
          return null
        })
        setPreviewError(message)
        setIsRendering(false)
      })

    return () => {
      active = false
      cancel()
    }
  }, [renderControls, hasContent, render, cancel])

  return {
    renderControls,
    setRenderControls,
    preview,
    previewError,
    setPreviewError,
    isRendering,
  }
}
