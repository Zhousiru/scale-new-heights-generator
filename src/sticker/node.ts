import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  STICKER_FLAVORS,
  normalizeAntialiasScale,
  normalizeRenderScale,
  normalizeStickerControls,
  type StickerControls,
  type StickerFlavor,
} from './config/defaults'
import { canvasToPngBytes } from './render/canvas'
import { renderSticker } from './render/sticker'
import { setCanvasRuntime, type CanvasRuntime } from './render/runtime'
import type { RenderIcon } from './render/types'
import { iconIdToUrl } from './utils/iconLoader'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type StickerRenderInput = DeepPartial<StickerControls> | string
export type { StickerFlavor }

export interface StickerGeneratorRuntime extends CanvasRuntime {
  /** 注册字体。自定义 runtime 如果已自行注册字体，可以不实现。 */
  registerFont?: (filePath: string, family: string) => boolean
  /** 判断字体是否已注册，用于跳过重复 fallback 注册。 */
  hasFont?: (family: string) => boolean
  /** 从 SVG bytes 或路径加载图片；仅在需要 Iconify 前缀图标时使用。 */
  loadImage?: (source: Buffer | Uint8Array | string) => Promise<ImageBitmap> | ImageBitmap
}

interface NapiCanvasModule {
  GlobalFonts: {
    registerFromPath: (filePath: string, family: string) => unknown
    has: (family: string) => boolean
  }
  createCanvas: (width: number, height: number) => unknown
  loadImage: (source: Buffer | Uint8Array | string) => Promise<unknown>
}

export interface NodeStickerFontFiles {
  snh?: string
  bs?: string
  inter?: string
  appleColorEmoji?: string
  appleSymbols?: string
  notoColorEmoji?: string
  notoSansSymbols2?: string
}

export interface RenderStickerNodeOptions {
  /**
   * 默认会从包内 public 目录加载字体；部署时如果字体被复制到别处，可以显式覆盖。
   */
  fontFiles?: NodeStickerFontFiles
  /** 是否加载 Iconify 前缀图标。无头机器人若禁止出网，可设为 false。默认 true。 */
  loadIcon?: boolean
  /** 输出像素倍率。 */
  outputScale?: unknown
  /** 内部超采样抗锯齿倍率，支持 1-5x。默认跟随 controls，未配置时为 1.5。 */
  antialiasScale?: unknown
  /** 限制输出图片最长边。 */
  maxOutputEdge?: number
}

const FONT_FAMILY_BY_FLAVOR: Record<StickerFlavor, string> = {
  snh: 'DouyinSansBold',
  bs: 'YouSheBiaoTiHei',
}

const FONT_FILE_BY_FLAVOR: Record<StickerFlavor, string> = {
  snh: 'DouyinSansBold.woff2',
  bs: 'YouSheBiaoTiHei.ttf',
}

const FALLBACK_FONT_DESCRIPTORS = [
  { key: 'appleColorEmoji', family: 'Apple Color Emoji', file: 'AppleColorEmoji.ttf', optional: true },
  { key: 'appleSymbols', family: 'Apple Symbols', file: 'AppleSymbols.ttf', optional: true },
  { key: 'notoColorEmoji', family: 'Noto Color Emoji', file: 'NotoColorEmoji.ttf', optional: true },
  { key: 'notoSansSymbols2', family: 'Noto Sans Symbols 2', file: 'NotoSansSymbols2-Regular.ttf', optional: true },
] as const

const registeredFontPaths = new Set<string>()
let defaultRuntimePromise: Promise<StickerGeneratorRuntime> | null = null
let defaultGeneratorPromise: Promise<StickerGenerator> | null = null

async function importNapiCanvas(): Promise<NapiCanvasModule> {
  try {
    return await import('@napi-rs/canvas') as NapiCanvasModule
  } catch (cause) {
    throw new Error(
      'Node 无头渲染需要安装可选依赖 @napi-rs/canvas；或通过 new StickerGenerator(runtime) 传入自定义 canvas runtime。',
      { cause },
    )
  }
}

export function createNapiCanvasRuntime(): Promise<StickerGeneratorRuntime> {
  defaultRuntimePromise ??= importNapiCanvas().then((canvas) => ({
    createCanvas: (width, height) =>
      canvas.createCanvas(width, height) as OffscreenCanvas,
    toPngBytes: (runtimeCanvas) => {
      const buffer = (runtimeCanvas as unknown as {
        toBuffer: (mime: string) => Buffer
      }).toBuffer('image/png')
      return new Uint8Array(buffer)
    },
    registerFont: (filePath, family) =>
      Boolean(canvas.GlobalFonts.registerFromPath(filePath, family)),
    hasFont: (family) => canvas.GlobalFonts.has(family),
    loadImage: async (source) =>
      await canvas.loadImage(source) as unknown as ImageBitmap,
  }))
  return defaultRuntimePromise
}

async function defaultGenerator(): Promise<StickerGenerator> {
  defaultGeneratorPromise ??= createNapiCanvasRuntime().then(
    (runtime) => new StickerGenerator(runtime),
  )
  return defaultGeneratorPromise
}

function normalizeRenderInput(input: StickerRenderInput): StickerControls {
  if (typeof input === 'string') {
    return normalizeStickerControls({ text: input })
  }
  return normalizeStickerControls(input)
}

function candidateFontUrls(fileName: string): URL[] {
  return [
    new URL(`../../public/${fileName}`, import.meta.url),
    new URL(`../public/${fileName}`, import.meta.url),
    new URL(`./fonts/${fileName}`, import.meta.url),
  ]
}

function resolveBundledFontFile(fileName: string): string {
  for (const url of candidateFontUrls(fileName)) {
    const filePath = fileURLToPath(url)
    if (existsSync(filePath)) return filePath
  }

  throw new Error(
    `找不到字体文件 ${fileName}。请确认 npm 包包含 public 目录，或通过 fontFiles 显式传入字体路径。`,
  )
}

function resolveOptionalBundledFontFile(fileName: string): string {
  for (const url of candidateFontUrls(fileName)) {
    const filePath = fileURLToPath(url)
    if (existsSync(filePath)) return filePath
  }
  return ''
}

function resolveInterFontFile(): string {
  try {
    const require = createRequire(import.meta.url)
    return require.resolve('inter-ui/web-latin/Inter-Bold-subset.woff2')
  } catch {
    return ''
  }
}

function registerStickerFontsWithRuntime(
  runtime: StickerGeneratorRuntime,
  fontFiles: NodeStickerFontFiles = {},
): void {
  if (!runtime.registerFont) return

  for (const flavor of STICKER_FLAVORS) {
    const fontPath = fontFiles[flavor] ?? resolveBundledFontFile(FONT_FILE_BY_FLAVOR[flavor])
    if (registeredFontPaths.has(fontPath)) continue

    const registered = runtime.registerFont(
      fontPath,
      FONT_FAMILY_BY_FLAVOR[flavor],
    )
    if (!registered) {
      throw new Error(`注册字体失败：${fontPath}`)
    }
    registeredFontPaths.add(fontPath)
  }

  // 西文 fallback：Inter（拉丁子集）。缺失时静默跳过，退回系统 sans-serif。
  const interPath = fontFiles.inter ?? resolveInterFontFile()
  if (interPath && !registeredFontPaths.has(interPath) && !runtime.hasFont?.('Inter')) {
    if (runtime.registerFont(interPath, 'Inter')) {
      registeredFontPaths.add(interPath)
    } else {
      console.warn('[sticker] fallback 字体注册失败：Inter')
    }
  }

  for (const descriptor of FALLBACK_FONT_DESCRIPTORS) {
    if (runtime.hasFont?.(descriptor.family)) continue
    const explicitPath = fontFiles[descriptor.key]
    const fontPath = explicitPath ?? resolveOptionalBundledFontFile(descriptor.file)
    if (!fontPath) {
      if (!descriptor.optional) {
        throw new Error(`找不到 fallback 字体文件 ${descriptor.file}。`)
      }
      continue
    }
    if (registeredFontPaths.has(fontPath)) continue

    const registered = runtime.registerFont(fontPath, descriptor.family)
    if (!registered) {
      console.warn(`[sticker] fallback 字体注册失败：${descriptor.family}`)
      continue
    }
    registeredFontPaths.add(fontPath)
  }
}

export async function registerStickerFonts(
  fontFiles: NodeStickerFontFiles = {},
  runtime?: StickerGeneratorRuntime,
): Promise<void> {
  registerStickerFontsWithRuntime(
    runtime ?? await createNapiCanvasRuntime(),
    fontFiles,
  )
}

async function loadNodeIconImage(
  iconId: string,
  runtime: StickerGeneratorRuntime,
  primaryColor: string,
): Promise<RenderIcon | null> {
  const duotone = /duotone/i.test(iconId)
  const url = iconIdToUrl(iconId, duotone ? primaryColor : undefined)
  if (!url) return null
  if (!runtime.loadImage) {
    throw new Error(
      '当前 canvas runtime 未提供 loadImage，无法加载前缀图标；可设置 loadIcon: false，或实现 runtime.loadImage。',
    )
  }

  const response = await fetch(url)
  if (!response.ok) return null
  const svg = await response.text()
  if (!svg.includes('<svg')) return null

  const colored =
    duotone || /(?:fill|stop-color)\s*=\s*["']\s*(?:#|rgb\(|hsl\()/i.test(svg)
  const bitmap = await runtime.loadImage(Buffer.from(svg))
  return { bitmap, colored }
}

export async function renderStickerToPngBytes(
  input: StickerRenderInput,
  options: RenderStickerNodeOptions = {},
): Promise<Uint8Array> {
  return await (await defaultGenerator()).renderPngBytes(input, options)
}

export async function renderStickerToBuffer(
  input: StickerRenderInput,
  options: RenderStickerNodeOptions = {},
): Promise<Buffer> {
  return await (await defaultGenerator()).renderBuffer(input, options)
}

export class StickerGenerator {
  readonly runtime: StickerGeneratorRuntime

  constructor(runtime: StickerGeneratorRuntime) {
    this.runtime = runtime
    setCanvasRuntime(runtime)
  }

  registerFonts(fontFiles: NodeStickerFontFiles = {}): void {
    registerStickerFontsWithRuntime(this.runtime, fontFiles)
  }

  async renderPngBytes(
    input: StickerRenderInput,
    options: RenderStickerNodeOptions = {},
  ): Promise<Uint8Array> {
    this.registerFonts(options.fontFiles)

    const controls = normalizeRenderInput(input)
    const icon =
      options.loadIcon === false
        ? null
        : await loadNodeIconImage(
          controls.icon,
          this.runtime,
          controls.envelope.colors[0] ?? '#ffffff',
        )
    const result = await renderSticker(controls, icon, {
      outputScale: normalizeRenderScale(options.outputScale),
      antialiasScale: options.antialiasScale === undefined
        ? undefined
        : normalizeAntialiasScale(options.antialiasScale),
      maxOutputEdge: options.maxOutputEdge,
    })
    return await canvasToPngBytes(result.canvas)
  }

  async renderBuffer(
    input: StickerRenderInput,
    options: RenderStickerNodeOptions = {},
  ): Promise<Buffer> {
    const bytes = await this.renderPngBytes(input, options)
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
}

