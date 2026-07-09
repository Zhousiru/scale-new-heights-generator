import type { StickerFlavor } from './defaults'

interface StickerPresetSeed {
  text: string
  /** 下拉框展示文案：图标 emoji + 文案。 */
  label?: string
  /** 渐变颜色停靠点，长度 1~3。 */
  colors: string[]
  /** 仅用于极少数覆盖组默认值的场景；大多数预设不要显式写默认值。 */
  flavor?: StickerFlavor
  gradientAngle?: number
  icon?: string
  /** 圆形/徽章类图标不适合随文字斜切。 */
  iconTilt?: boolean
}

export interface StickerPreset extends StickerPresetSeed {
  flavor: StickerFlavor
  gradientAngle: number
  icon: string
  iconTilt: boolean
}

type PresetDefaults = Pick<StickerPreset, 'flavor' | 'gradientAngle' | 'icon' | 'iconTilt'>

const PRESET_DEFAULTS: PresetDefaults = {
  flavor: 'snh',
  gradientAngle: 180,
  icon: '',
  iconTilt: true,
}

// 颜色来自 ~/Downloads/表情包 下 PNG 的高饱和像素采样。优先保留单色，
// 只有跨明显色系（如绿→橙、青→紫）时才写入多个停靠点。
export const STICKER_PRESETS: Record<string, StickerPresetSeed[]> = {
  字节范: [
    { text: '始终创业', label: '🗓 始终创业', colors: ['#8d0', '#6da'], icon: 'mdi:numeric-1-box' },
    { text: '多元兼容', label: '🪐 多元兼容', colors: ['#fae', '#d6d'], icon: 'tabler:planet', iconTilt: false },
    { text: '坦诚清晰', label: '💬 坦诚清晰', colors: ['#ff975c'], icon: 'mdi:message-text' },
    { text: '求真务实', label: '🔍 求真务实', colors: ['#69d1f2', '#c55be7'], icon: 'mdi:magnify', iconTilt: false },
    { text: '敢为极致', label: '✨ 敢为极致', colors: ['#fb609e'], icon: 'mdi:star-four-points', iconTilt: false },
    { text: '共同成长', label: '🌱 共同成长', colors: ['#73e8d7', '#14a38e'], icon: 'mdi:sprout' },
    { text: '领导力', label: '🔥 领导力', colors: ['#ffb65c'], icon: 'mdi:torch' },
    { text: '激发创造', label: '💡 激发创造', colors: ['#65baf6'], icon: 'mdi:lightbulb-on' },
    { text: '丰富生活', label: '🎵 丰富生活', colors: ['#68d9f2'], icon: 'mdi:music' },
  ],
  勇攀高峰: [
    { text: '勇攀高峰', colors: ['#5c95e5'] },
    { text: '高峰不常有', colors: ['#a8d8ff'] },
    { text: '高度优先', colors: ['#e69a35'] },
    { text: '重点突破', colors: ['#eb5328'] },
    { text: '聚焦', colors: ['#3179e2'] },
    { text: '创新推动', colors: ['#3388dd', '#ccaa44'] },
  ],
  务实浪漫系列: [
    { text: '做了≠做好了', label: '☑️ 做了≠做好了', colors: ['#42e34d'], icon: 'mdi:check-bold' },
    { text: '不断创新', label: '💡 不断创新', colors: ['#02b0f1', '#02d294'], icon: 'mdi:head-lightbulb' },
    { text: '敢想敢干', label: '✊ 敢想敢干', colors: ['#0fbfe3'], icon: 'mdi:hand-back-right' },
    { text: '务实浪漫', label: '🪐 务实浪漫', colors: ['#7e40e3', '#2f62f1'], icon: 'mdi:star-shooting' },
    { text: '梦想实现中', label: '⌛️ 梦想实现中', colors: ['#3a85f0'], icon: 'mdi:bird' },
    { text: '快速行动', label: '🏃‍♂️ 快速行动', colors: ['#fe2191'] },
    { text: '一起改变', label: '👥 一起改变', colors: ['#fcaf03', '#f38121', '#f35e3b'], icon: 'mdi:account-multiple' },
    { text: 'We Are ByteDancers', label: 'Ⓑ We Are ByteDancers', colors: ['#0080f1'], icon: 'mdi:alpha-b-circle', iconTilt: false },
  ],
  地震级创意: [
    { text: '快速对对', colors: ['#4d52e9', '#9539f9'] },
    { text: '承受因果', colors: ['#58a703', '#d99005', '#fd5b4a'] },
    { text: '语音对一下', colors: ['#09c962', '#14a2c0'], gradientAngle: 90 },
    { text: '震感强烈', colors: ['#9949c1', '#d89a7e', '#feca49'] },
  ],
}

export type StickerPresetGroup = keyof typeof STICKER_PRESETS

const PRESET_GROUP_DEFAULTS: Record<string, Partial<PresetDefaults>> = {
  字节范: { flavor: 'bs', gradientAngle: 90 },
  勇攀高峰: { gradientAngle: 0 },
  务实浪漫系列: { gradientAngle: 90 },
  地震级创意: { gradientAngle: 180 },
}

export const STICKER_PRESET_LIST: StickerPreset[] = Object.entries(
  STICKER_PRESETS,
).flatMap(([group, presets]) => {
  const groupDefaults = PRESET_GROUP_DEFAULTS[group as StickerPresetGroup]
  return presets.map((preset) => ({
    ...PRESET_DEFAULTS,
    ...groupDefaults,
    ...preset,
    label: preset.label ?? preset.text,
  }))
})
