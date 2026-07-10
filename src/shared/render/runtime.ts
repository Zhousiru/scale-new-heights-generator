export interface CanvasRuntime {
  createCanvas: (width: number, height: number) => OffscreenCanvas
  toPngBytes?: (canvas: OffscreenCanvas) => Promise<Uint8Array> | Uint8Array
}

const browserRuntime: CanvasRuntime = {
  createCanvas: (width, height) =>
    new OffscreenCanvas(
      Math.max(1, Math.ceil(width)),
      Math.max(1, Math.ceil(height)),
    ),
}

let activeRuntime: CanvasRuntime = browserRuntime

export function setCanvasRuntime(runtime: CanvasRuntime): () => void {
  const previousRuntime = activeRuntime
  activeRuntime = runtime
  return () => {
    activeRuntime = previousRuntime
  }
}

export function createRuntimeCanvas(width: number, height: number): OffscreenCanvas {
  return activeRuntime.createCanvas(
    Math.max(1, Math.ceil(width)),
    Math.max(1, Math.ceil(height)),
  )
}

export async function runtimeCanvasToPngBytes(
  canvas: OffscreenCanvas,
): Promise<Uint8Array> {
  if (activeRuntime.toPngBytes) {
    return activeRuntime.toPngBytes(canvas)
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}
