import { Buffer } from 'node:buffer'
import {
  runtimeCanvasToPngBytes,
  setCanvasRuntime,
  type CanvasRuntime,
} from '../shared/render/runtime'
import type { TextRenderInput } from '../shared/render/input'
import type { AvatarControls } from './config/defaults'
import { renderAvatar } from './render/avatar'

export type AvatarRenderInput = TextRenderInput<AvatarControls>

export interface AvatarGeneratorRuntime extends CanvasRuntime {}

interface NapiCanvasModule {
  createCanvas: (width: number, height: number) => unknown
}

let defaultRuntimePromise: Promise<AvatarGeneratorRuntime> | null = null
let defaultGeneratorPromise: Promise<AvatarGenerator> | null = null

async function importNapiCanvas(): Promise<NapiCanvasModule> {
  try {
    return await import('@napi-rs/canvas') as NapiCanvasModule
  } catch (cause) {
    throw new Error(
      'Node 无头渲染需要安装可选依赖 @napi-rs/canvas；或通过 new AvatarGenerator(runtime) 传入自定义 canvas runtime。',
      { cause },
    )
  }
}

export function createNapiCanvasRuntime(): Promise<AvatarGeneratorRuntime> {
  defaultRuntimePromise ??= importNapiCanvas().then((canvas) => ({
    createCanvas: (width, height) =>
      canvas.createCanvas(width, height) as OffscreenCanvas,
    toPngBytes: (runtimeCanvas) => {
      const buffer = (runtimeCanvas as unknown as {
        toBuffer: (mime: string) => Buffer
      }).toBuffer('image/png')
      return new Uint8Array(buffer)
    },
  }))
  return defaultRuntimePromise
}

async function defaultGenerator(): Promise<AvatarGenerator> {
  defaultGeneratorPromise ??= createNapiCanvasRuntime().then(
    (runtime) => new AvatarGenerator(runtime),
  )
  return defaultGeneratorPromise
}

export async function renderAvatarToPngBytes(
  input: AvatarRenderInput,
): Promise<Uint8Array> {
  return await (await defaultGenerator()).renderPngBytes(input)
}

export async function renderAvatarToBuffer(
  input: AvatarRenderInput,
): Promise<Buffer> {
  return await (await defaultGenerator()).renderBuffer(input)
}

export class AvatarGenerator {
  readonly runtime: AvatarGeneratorRuntime

  constructor(runtime: AvatarGeneratorRuntime) {
    this.runtime = runtime
    setCanvasRuntime(runtime)
  }

  async renderPngBytes(
    input: AvatarRenderInput,
  ): Promise<Uint8Array> {
    const result = await renderAvatar(input)
    return await runtimeCanvasToPngBytes(result.canvas)
  }

  async renderBuffer(
    input: AvatarRenderInput,
  ): Promise<Buffer> {
    const bytes = await this.renderPngBytes(input)
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
}
