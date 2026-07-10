import { renderSticker } from '../render/sticker'
import type { WorkerRequest, WorkerResponse } from '../config/workerProtocol'
import { ensureInterFontLoaded } from './interFont'
import { postImageWorkerResult } from '../../shared/worker/imageWorker'

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { type, id, controls, icon } = e.data

  try {
    await ensureInterFontLoaded().catch(() => undefined)
    const result = await renderSticker(controls, icon, {
      antialiasScale: controls.antialiasScale,
    })
    await postImageWorkerResult(
      id,
      type,
      result,
      controls.flash,
      controls.flashStops,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '渲染失败。'
    const msg: WorkerResponse = { type: 'error', id, message }
    postMessage(msg)
  }
}
