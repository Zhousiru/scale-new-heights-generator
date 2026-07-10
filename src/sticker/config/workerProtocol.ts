import type { StickerControls } from './defaults'
import type { ImageWorkerResponse } from '../../shared/worker/imageWorker'

export interface WorkerIcon {
  bitmap: ImageBitmap
  colored: boolean
}

export type WorkerRequest =
  | { type: 'render'; id: number; controls: StickerControls; icon: WorkerIcon | null }
  | { type: 'export'; id: number; controls: StickerControls; icon: WorkerIcon | null }

export type WorkerResponse = ImageWorkerResponse
