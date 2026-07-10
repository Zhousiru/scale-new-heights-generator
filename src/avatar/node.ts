import { Buffer } from 'node:buffer'
import {
  runtimeCanvasToPngBytes,
  setCanvasRuntime,
  type CanvasRuntime,
} from '../shared/render/runtime'
import {
  normalizeAvatarControls,
  type AvatarControls,
} from './config/defaults'
import { renderAvatar } from './render/avatar'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type AvatarRenderInput = DeepPartial<AvatarControls> | string

export interface AvatarGeneratorRuntime extends CanvasRuntime {}

interface NapiCanvasModule {
  createCanvas: (width: number, height: number) => unknown
}

export interface RenderAvatarNodeOptions {
  antialiasScale?: unknown
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

function normalizeRenderInput(input: AvatarRenderInput): AvatarControls {
  if (typeof input === 'string') {
    return normalizeAvatarControls({ text: input })
  }
  return normalizeAvatarControls(input)
}

export async function renderAvatarToPngBytes(
  input: AvatarRenderInput,
  options: RenderAvatarNodeOptions = {},
): Promise<Uint8Array> {
  return await (await defaultGenerator()).renderPngBytes(input, options)
}

export async function renderAvatarToBuffer(
  input: AvatarRenderInput,
  options: RenderAvatarNodeOptions = {},
): Promise<Buffer> {
  return await (await defaultGenerator()).renderBuffer(input, options)
}

export class AvatarGenerator {
  readonly runtime: AvatarGeneratorRuntime

  constructor(runtime: AvatarGeneratorRuntime) {
    this.runtime = runtime
    setCanvasRuntime(runtime)
  }

  async renderPngBytes(
    input: AvatarRenderInput,
    options: RenderAvatarNodeOptions = {},
  ): Promise<Uint8Array> {
    const result = await renderAvatar(normalizeRenderInput(input), {
      antialiasScale: options.antialiasScale === undefined
        ? undefined
        : numberOption(options.antialiasScale),
    })
    return await runtimeCanvasToPngBytes(result.canvas)
  }

  async renderBuffer(
    input: AvatarRenderInput,
    options: RenderAvatarNodeOptions = {},
  ): Promise<Buffer> {
    const bytes = await this.renderPngBytes(input, options)
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
}

function numberOption(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined
}
