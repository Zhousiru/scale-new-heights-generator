// Web 端西文 fallback 字体。渲染跑在 Worker + OffscreenCanvas 里，字体必须显式
// 用 FontFace 加载并 add 进 fonts 集合，canvas 才能命中；单纯引 CSS 无效。
// 只取拉丁子集（含 ASCII 字母 / 数字 / 常见标点），中文仍走系统 PingFang。
import interBoldUrl from 'inter-ui/web-latin/Inter-Bold-subset.woff2?url'

const INTER_FEATURE_SETTINGS = '"ss01" 1, "ss04" 1'

let promise: Promise<void> | null = null

export function ensureInterFontLoaded(): Promise<void> {
  if (typeof FontFace === 'undefined') return Promise.resolve()

  promise ??= (async () => {
    const fonts: FontFaceSet | undefined =
      typeof document !== 'undefined'
        ? document.fonts
        : (globalThis as unknown as { fonts?: FontFaceSet }).fonts
    if (!fonts) return

    const fontFace = new FontFace('Inter', `url(${interBoldUrl})`, {
      style: 'normal',
      weight: 'bold',
      featureSettings: INTER_FEATURE_SETTINGS,
    })
    const loaded = await fontFace.load()
    fonts.add(loaded)
  })().catch((error: unknown) => {
    promise = null
    throw error
  })

  return promise
}
