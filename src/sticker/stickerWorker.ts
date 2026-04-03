import type { StickerControls } from './defaults'
import type { WorkerResponse } from './workerProtocol'

export interface PreviewResult {
  bitmap: ImageBitmap
  width: number
  height: number
}

interface PendingRequest {
  resolve: (value: never) => void
  reject: (reason: Error) => void
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./renderSticker.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)

      if (data.type === 'error') {
        request.reject(new Error(data.message))
      } else if (data.type === 'render-result') {
        request.resolve({ bitmap: data.bitmap, width: data.width, height: data.height } as never)
      } else {
        request.resolve(data.blob as never)
      }
    }
  }
  return worker
}

export function renderStickerPreview(controls: StickerControls): Promise<PreviewResult> {
  const id = nextId++
  const w = getWorker()
  return new Promise<PreviewResult>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject })
    w.postMessage({ type: 'render', id, controls })
  })
}

export function exportStickerBlob(controls: StickerControls): Promise<Blob> {
  const id = nextId++
  const w = getWorker()
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject })
    w.postMessage({ type: 'export', id, controls })
  })
}

export function cancelPendingPreviews(): void {
  if (!worker) return
  worker.terminate()
  worker = null
  for (const request of pending.values()) {
    request.reject(new Error('Cancelled'))
  }
  pending.clear()
}
