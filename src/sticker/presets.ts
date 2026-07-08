import type { StickerFlavor } from './defaults'

/** 预设所属分组，用于下拉框 optgroup 展示。 */
export type StickerPresetGroup = '字节范' | '勇攀高峰' | '务实浪漫系列'

export interface StickerPreset {
  text: string
  /** 渐变颜色停靠点，长度 1~3。 */
  colors: string[]
  gradientAngle: number
  flavor: StickerFlavor
  /** 分组标签（对应参考表情包文件夹）。 */
  group: StickerPresetGroup
  /** 前缀图标的 Iconify id，无图标则为 ''。 */
  icon: string
}

// 颜色取自参考表情包 PNG 的主色调采样，字节范文件夹的条目使用优设标题黑字面；
// 图标是原图中观察到的前缀字形，映射为 Iconify id。顺序与分组按参考图排布。
export const STICKER_PRESETS: StickerPreset[] = [
  // ── 字节范 ──
  { text: '始终创业', colors: ['#9af665', '#44b305'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:numeric-1-circle' },
  { text: '多元兼容', colors: ['#ef6cdf', '#ed12d3'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:planet' },
  { text: '坦诚清晰', colors: ['#ff975c', '#fb5b00'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:message-text' },
  { text: '求真务实', colors: ['#69d1f2', '#0989b2'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:magnify' },
  { text: '敢为极致', colors: ['#fb609e', '#fa0064'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:star-four-points' },
  { text: '共同成长', colors: ['#73e8d7', '#14a38e'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:sprout' },
  { text: '领导力', colors: ['#ffb65c', '#ff8d00'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:torch' },
  { text: '激发创造', colors: ['#65baf6', '#056db6'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:lightbulb-on' },
  { text: '丰富生活', colors: ['#68d9f2', '#0aa3c5'], gradientAngle: 180, flavor: 'bs', group: '字节范', icon: 'mdi:music' },
  // ── 勇攀高峰 ──
  { text: '勇攀高峰', colors: ['#5c95e5', '#1450a3'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  { text: '高峰不常有', colors: ['#5eb4fc', '#0089ff'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  { text: '高度优先', colors: ['#e69a35', '#e88d14'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  { text: '重点突破', colors: ['#eb5328', '#c1330b'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  { text: '聚焦', colors: ['#3179e2', '#114ea6'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  { text: '创新推动', colors: ['#369cde', '#1b90db'], gradientAngle: 180, flavor: 'snh', group: '勇攀高峰', icon: '' },
  // ── 务实浪漫系列 ──
  { text: '做了≠做好了', colors: ['#3dee40', '#0cf311'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:check-bold' },
  { text: '不断创新', colors: ['#14cfff', '#00a4ce'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:head-lightbulb' },
  { text: '敢想敢干', colors: ['#1aa8f9', '#0095e9'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:hand-back-right' },
  { text: '务实浪漫', colors: ['#755df6', '#2c06f9'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:star-shooting' },
  { text: '梦想实现中', colors: ['#2079f4', '#045eda'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:bird' },
  { text: '快速行动', colors: ['#ff1d7d', '#ff006c'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: '' },
  { text: '一起改变', colors: ['#fe872a', '#ff7000'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:account-multiple' },
  { text: 'WeAreByteDancers', colors: ['#14a6ff', '#008adf'], gradientAngle: 180, flavor: 'snh', group: '务实浪漫系列', icon: 'mdi:alpha-b-circle' },
]

/** 预设分组的展示顺序。 */
export const STICKER_PRESET_GROUPS: StickerPresetGroup[] = [
  '勇攀高峰',
  '务实浪漫系列',
  '字节范',
]
