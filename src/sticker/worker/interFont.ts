// Web 端西文字体。渲染跑在 Worker + OffscreenCanvas 里，字体必须显式
// 用 FontFace 加载并 add 进 fonts 集合，canvas 才能命中；单纯引 CSS 无效。
// 只取拉丁子集（含 ASCII 字母 / 数字 / 常见标点），中文仍走系统 PingFang。
import interBoldUrl from 'inter-ui/web-latin/Inter-Bold-subset.woff2?url'
import {
  LATIN_FONT_FAMILY,
  LATIN_FONT_FEATURE_SETTINGS,
} from '../config/fonts'
import { loadFontFace } from '../render/fontFace'

let promise: Promise<void> | null = null

export function ensureInterFontLoaded(): Promise<void> {
  promise ??= loadFontFace({
    family: LATIN_FONT_FAMILY,
    source: `url(${interBoldUrl})`,
    style: 'normal',
    weight: 'bold',
    featureSettings: LATIN_FONT_FEATURE_SETTINGS,
  }).catch((error: unknown) => {
    promise = null
    throw error
  })

  return promise
}
