import { colord } from 'colord'

// 从某个基色推导同色系的“更深”配套色：同色相、略微更饱和且更暗，读起来像一个
// 有层次的饱和色（而非褪向灰/白）。用于单色渐变自动补出深色停靠点。
export function deriveDepthColor(base: string): string {
  return colord(base).saturate(0.08).darken(0.22).toHex()
}

// 把用户配置的 1~3 个颜色规整为渐变停靠点：
//   • 单色：自动补出同色系深色，形成 [浅, 深] 对；方向由用户的角度旋钮控制。
//   • 双色/三色：原样使用。
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

// 相对某个基色随机生成一个鲜亮单色。随机在“同色相”与“邻色相”之间选择，
// 单色模式下由渲染层自动补出同色系深浅（方向随角度旋钮）。
export function randomVividColor(
  base: string,
  random: () => number = Math.random,
): string {
  const { h } = colord(base).toHsl()
  const adjacent = random() < 0.5

  const hue = adjacent ? h + (random() < 0.5 ? -1 : 1) * (15 + random() * 30) : h
  const saturation = adjacent ? 70 + random() * 25 : 60 + random() * 30
  const lightness = adjacent ? 58 + random() * 10 : 55 + random() * 12

  return colord({
    h: ((hue % 360) + 360) % 360,
    s: saturation,
    l: lightness,
  }).toHex()
}
