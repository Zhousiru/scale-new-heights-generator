import type { StickerControls } from '../config/defaults'
import type { WorkerResponse } from '../config/workerProtocol'
import { loadIconBitmap } from '../utils/iconLoader'

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

// duotone 图标注入贴纸主色（首个配色）；其余图标忽略该参数。
function iconPrimaryColor(controls: StickerControls): string {
  return controls.envelope.colors[0] ?? '#ffffff'
}

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
    void loadIconBitmap(controls.icon, iconPrimaryColor(controls)).then((icon) => {
      w.postMessage(
        { type: 'render', id, controls, icon },
        { transfer: icon ? [icon.bitmap] : [] },
      )
    })
  })
}

export function exportStickerBlob(controls: StickerControls): Promise<Blob> {
  const id = nextId++
  const w = getWorker()
  return new Promise<Blob>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: never) => void, reject })
    void loadIconBitmap(controls.icon, iconPrimaryColor(controls)).then((icon) => {
      w.postMessage(
        { type: 'export', id, controls, icon },
        { transfer: icon ? [icon.bitmap] : [] },
      )
    })
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
