import type { AvatarControls } from './defaults'
import type { ImageWorkerResponse } from '../../shared/worker/imageWorker'

export type AvatarWorkerRequest =
  | { type: 'render'; id: number; controls: AvatarControls }
  | { type: 'export'; id: number; controls: AvatarControls }

export type AvatarWorkerResponse = ImageWorkerResponse
