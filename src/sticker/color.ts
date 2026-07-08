import { colord } from 'colord'

interface LinearRgb {
  r: number
  g: number
  b: number
}

interface Oklch {
  l: number
  c: number
  h: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function srgbToLinear(value: number): number {
  const channel = value / 255
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number): number {
  const channel = value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055
  return Math.round(clamp(channel, 0, 1) * 255)
}

function rgbToOklch(color: string): Oklch {
  const { r, g, b } = colord(color).toRgb()
  const linearR = srgbToLinear(r)
  const linearG = srgbToLinear(g)
  const linearB = srgbToLinear(b)

  const l = Math.cbrt(
    0.4122214708 * linearR + 0.5363325363 * linearG + 0.0514459929 * linearB,
  )
  const m = Math.cbrt(
    0.2119034982 * linearR + 0.6806995451 * linearG + 0.1073969566 * linearB,
  )
  const s = Math.cbrt(
    0.0883024619 * linearR + 0.2817188376 * linearG + 0.6299787005 * linearB,
  )

  const labL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const labA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  return {
    l: labL,
    c: Math.hypot(labA, labB),
    h: Math.atan2(labB, labA),
  }
}

function oklchToLinearRgb({ l, c, h }: Oklch): LinearRgb {
  const labA = Math.cos(h) * c
  const labB = Math.sin(h) * c
  const lPrime = l + 0.3963377774 * labA + 0.2158037573 * labB
  const mPrime = l - 0.1055613458 * labA - 0.0638541728 * labB
  const sPrime = l - 0.0894841775 * labA - 1.291485548 * labB
  const cubeL = lPrime ** 3
  const cubeM = mPrime ** 3
  const cubeS = sPrime ** 3

  return {
    r: 4.0767416621 * cubeL - 3.3077115913 * cubeM + 0.2309699292 * cubeS,
    g: -1.2684380046 * cubeL + 2.6097574011 * cubeM - 0.3413193965 * cubeS,
    b: -0.0041960863 * cubeL - 0.7034186147 * cubeM + 1.707614701 * cubeS,
  }
}

function isDisplayable({ r, g, b }: LinearRgb): boolean {
  return r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1
}

function oklchToHexInGamut(color: Oklch): string {
  let low = 0
  let high = color.c
  let rgb = oklchToLinearRgb(color)

  // 降亮度后部分高 chroma 颜色会超出 sRGB；二分压 chroma，尽量保留色相和力度。
  for (let i = 0; i < 18 && !isDisplayable(rgb); i += 1) {
    high = (low + high) / 2
    rgb = oklchToLinearRgb({ ...color, c: high })
  }

  if (!isDisplayable(rgb)) {
    for (let i = 0; i < 18; i += 1) {
      const mid = (low + high) / 2
      const candidate = oklchToLinearRgb({ ...color, c: mid })
      if (isDisplayable(candidate)) {
        low = mid
        rgb = candidate
      } else {
        high = mid
      }
    }
  }

  return colord({
    r: linearToSrgb(rgb.r),
    g: linearToSrgb(rgb.g),
    b: linearToSrgb(rgb.b),
  }).toHex()
}

// 从某个基色推导同色系的“更深”配套色：在 OKLCH 中保持色相、
// 温和降低感知亮度，并按原 chroma 强度轻压 chroma，避免高饱和浅色生成刺眼暗色。
export function deriveDepthColor(base: string): string {
  const oklch = rgbToOklch(base)
  const chromaScale = clamp(0.98 - oklch.c * 0.9, 0.74, 0.94)
  return oklchToHexInGamut({
    l: Math.max(0.28, oklch.l - 0.17),
    c: oklch.c * chromaScale,
    h: oklch.h,
  })
}

// 把用户配置的 1~3 个颜色规整为渐变停靠点：
//   • 单色：自动补出同色系深色，形成 [浅, 深] 对；方向由用户的角度旋钮控制。
//   • 双色/三色：保留用户传入的端点色，不额外插值。
export function resolveGradientStops(colors: string[]): string[] {
  if (colors.length <= 1) {
    const base = colors[0] ?? '#76baf4'
    return [base, deriveDepthColor(base)]
  }
  return colors
}

// 通道级压暗：按 (1-amount) 缩放 RGB 分量后返回 rgb() 字符串。保持与旧实现一致的
// 数值语义，用于 snh 边缘轮廓与 bs 外层带的加深。
export function darken(color: string, amount: number): string {
  const { r, g, b } = colord(color).toRgb()
  const scale = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel * (1 - amount))))
  return `rgb(${scale(r)}, ${scale(g)}, ${scale(b)})`
}

const RANDOM_HUE_BUCKETS = [
  [206, 224], // 蓝
  [186, 198], // 青
  [154, 172], // 青绿
  [112, 132], // 绿
  [38, 52], // 黄橙
  [18, 30], // 橙
  [350, 360], // 红
  [260, 276], // 紫
] as const

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return Math.min(diff, 360 - diff)
}

// 从均衡色相桶里随机生成鲜亮单色。之前基于当前颜色做邻色随机，会连续游走到粉紫段；
// 这里改成独立抽样，并避开与当前色过近的桶，让连续点击更均匀。
export function randomVividColor(
  base: string,
  random: () => number = Math.random,
): string {
  const { h } = colord(base).toHsl()
  const candidates = RANDOM_HUE_BUCKETS.filter(([min, max]) => {
    const center = min > max ? (min + max + 360) / 2 % 360 : (min + max) / 2
    return hueDistance(center, h) > 28
  })
  const buckets = candidates.length > 0 ? candidates : RANDOM_HUE_BUCKETS
  const [minHue, maxHue] = buckets[Math.floor(random() * buckets.length)]

  const hue = minHue + random() * (maxHue - minHue)
  const saturation = 72 + random() * 18
  const lightness = 56 + random() * 10

  return colord({
    h: ((hue % 360) + 360) % 360,
    s: saturation,
    l: lightness,
  }).toHex()
}
