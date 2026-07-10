import { renderAvatar } from '../render/avatar'
import type {
  AvatarWorkerRequest,
  AvatarWorkerResponse,
} from '../config/workerProtocol'
import { postImageWorkerResult } from '../../shared/worker/imageWorker'

self.onmessage = async (e: MessageEvent<AvatarWorkerRequest>) => {
  const { type, id, controls } = e.data

  try {
    const result = await renderAvatar(controls, {
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
    const msg: AvatarWorkerResponse = { type: 'error', id, message }
    postMessage(msg)
  }
}
