import type {
  ImageFileResult,
  PreviewResult,
} from '../components/ImagePreview'
import {
  encodeUltraHdrJpegFromCanvas,
  ULTRA_HDR_JPEG_EXTENSION,
  ULTRA_HDR_JPEG_MIME,
} from '../hdr/ultraHdrJpeg'

export type ImageWorkerResponse =
  | ({ type: 'render-result'; id: number } & PreviewResult)
  | ({ type: 'export-result'; id: number } & ImageFileResult)
  | { type: 'error'; id: number; message: string }

interface WorkerRenderResult {
  canvas: OffscreenCanvas
  width: number
  height: number
  toBlob: () => Promise<Blob>
  toBitmap: () => ImageBitmap
}

interface PendingRequest {
  resolve: (value: PreviewResult | ImageFileResult) => void
  reject: (reason: Error) => void
}

export function createImageWorkerClient<Response extends ImageWorkerResponse>(
  createWorker: () => Worker,
) {
  let worker: Worker | null = null
  let nextId = 0
  const pending = new Map<number, PendingRequest>()

  const getWorker = () => {
    if (worker) return worker

    worker = createWorker()
    worker.onmessage = (event: MessageEvent<Response>) => {
      const data = event.data
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)

      if (data.type === 'error') {
        request.reject(new Error(data.message))
      } else {
        request.resolve(responsePayload(data))
      }
    }
    return worker
  }

  return {
    request<T extends PreviewResult | ImageFileResult>(
      send: (worker: Worker, id: number) => void | Promise<void>,
    ): Promise<T> {
      const id = nextId++
      const target = getWorker()
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: resolve as (value: PreviewResult | ImageFileResult) => void,
          reject,
        })
        void Promise.resolve(send(target, id)).catch((error: unknown) => {
          pending.delete(id)
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      })
    },

    cancel(): void {
      if (!worker) return
      worker.terminate()
      worker = null
      for (const request of pending.values()) {
        request.reject(new Error('Cancelled'))
      }
      pending.clear()
    },
  }
}

export async function postImageWorkerResult(
  id: number,
  type: 'render' | 'export',
  result: WorkerRenderResult,
  flash: boolean,
  flashStops: number,
): Promise<void> {
  if (flash) {
    const blob = encodeUltraHdrJpegFromCanvas(result.canvas, { flashStops })
    postMessage(type === 'render'
      ? {
          type: 'render-result',
          id,
          kind: 'blob',
          blob,
          width: result.width,
          height: result.height,
          mime: ULTRA_HDR_JPEG_MIME,
          extension: ULTRA_HDR_JPEG_EXTENSION,
        } satisfies ImageWorkerResponse
      : {
          type: 'export-result',
          id,
          blob,
          mime: ULTRA_HDR_JPEG_MIME,
          extension: ULTRA_HDR_JPEG_EXTENSION,
        } satisfies ImageWorkerResponse)
    return
  }

  if (type === 'render') {
    const bitmap = result.toBitmap()
    const msg = {
      type: 'render-result',
      id,
      kind: 'bitmap',
      bitmap,
      width: result.width,
      height: result.height,
      mime: 'image/png',
      extension: 'png',
    } satisfies ImageWorkerResponse
    postMessage(msg, { transfer: [bitmap] })
    return
  }

  const blob = await result.toBlob()
  postMessage({
    type: 'export-result',
    id,
    blob,
    mime: 'image/png',
    extension: 'png',
  } satisfies ImageWorkerResponse)
}

function responsePayload(
  response: Exclude<ImageWorkerResponse, { type: 'error' }>,
): PreviewResult | ImageFileResult {
  if (response.type === 'render-result') return response
  return {
    blob: response.blob,
    mime: response.mime,
    extension: response.extension,
  }
}
