import { renderSticker } from '../render/sticker'
import type { WorkerRequest, WorkerResponse } from '../config/workerProtocol'
import { ensureInterFontLoaded } from './interFont'

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, id, controls, icon } = e.data

  try {
    await ensureInterFontLoaded().catch(() => undefined)
    const result = await renderSticker(controls, icon, {
      antialiasScale: controls.antialiasScale,
    })

    if (type === 'render') {
      const bitmap = result.toBitmap()
      const msg: WorkerResponse = {
        type: 'render-result',
        id,
        bitmap,
        width: result.width,
        height: result.height,
      }
      postMessage(msg, { transfer: [bitmap] })
    } else {
      const blob = await result.toBlob()
      const msg: WorkerResponse = { type: 'export-result', id, blob }
      postMessage(msg)
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '渲染失败。'
    const msg: WorkerResponse = { type: 'error', id, message }
    postMessage(msg)
  }
}
