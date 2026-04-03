import { renderSticker } from './renderSticker'
import type { WorkerRequest, WorkerResponse } from './workerProtocol'

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, id, controls } = e.data

  try {
    const result = await renderSticker(controls)

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
    const message = error instanceof Error ? error.message : 'Rendering failed.'
    const msg: WorkerResponse = { type: 'error', id, message }
    postMessage(msg)
  }
}
