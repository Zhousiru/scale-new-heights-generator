import type { StickerControls } from './defaults'

export type WorkerRequest =
  | { type: 'render'; id: number; controls: StickerControls; iconBitmap: ImageBitmap | null }
  | { type: 'export'; id: number; controls: StickerControls; iconBitmap: ImageBitmap | null }

export type WorkerResponse =
  | { type: 'render-result'; id: number; bitmap: ImageBitmap; width: number; height: number }
  | { type: 'export-result'; id: number; blob: Blob }
  | { type: 'error'; id: number; message: string }
