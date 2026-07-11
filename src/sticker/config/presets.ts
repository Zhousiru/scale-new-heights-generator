import {
  defaultGradientAngle,
  STICKER_DEFAULT_OUTLINE_WIDTH,
  type StickerFlavor,
} from './defaults'

interface StickerPresetSeed {
  text: string
  /** 渐变颜色停靠点，长度 1~3 */
  colors: string[]
  /** 仅用于极少数覆盖组默认值的场景；大多数预设不要显式写默认值 */
  flavor?: StickerFlavor
  gradientAngle?: number
  outlineStrokeWidth?: number
  icon?: string
  /** 圆形/徽章类图标不适合随文字斜切 */
  iconTilt?: boolean
}

export interface StickerPreset extends StickerPresetSeed {
  flavor: StickerFlavor
  gradientAngle: number
  outlineStrokeWidth: number
  icon: string
  iconTilt: boolean
}

type PresetDefaults = Pick<
  StickerPreset,
  'flavor' | 'gradientAngle' | 'outlineStrokeWidth' | 'icon' | 'iconTilt'
>

/** 贴纸预设的全局默认参数 */
const PRESET_DEFAULTS: PresetDefaults = {
  flavor: 'snh',
  gradientAngle: 180,
  outlineStrokeWidth: STICKER_DEFAULT_OUTLINE_WIDTH.snh,
  icon: '',
  iconTilt: true,
}

/** 贴纸预设种子表 */
export const STICKER_PRESETS: Record<string, StickerPresetSeed[]> = {
  字节范: [
    { text: '始终创业', colors: ['#8d0', '#6da'], icon: 'mdi:numeric-1-box' },
    { text: '多元兼容', colors: ['#fae', '#d6d'], icon: 'tabler:planet', iconTilt: false },
    { text: '坦诚清晰', colors: ['#ff975c'], icon: 'mdi:message-text' },
    { text: '求真务实', colors: ['#69d1f2', '#c55be7'], icon: 'mdi:magnify', iconTilt: false },
    { text: '敢为极致', colors: ['#fb609e'], icon: 'mdi:star-four-points', iconTilt: false },
    { text: '共同成长', colors: ['#73e8d7', '#14a38e'], icon: 'mdi:sprout' },
    { text: '领导力', colors: ['#ffb65c'], icon: 'mdi:torch' },
    { text: '激发创造', colors: ['#65baf6'], icon: 'mdi:lightbulb-on' },
    { text: '丰富生活', colors: ['#68d9f2'], icon: 'mdi:music' },
  ],
  勇攀高峰: [
    { text: '勇攀高峰', colors: ['#5c95e5'] },
    { text: '高峰不常有', colors: ['#08e', '#9cf'] },
    { text: '高度优先', colors: ['#e69a35'] },
    { text: '重点突破', colors: ['#eb5328'] },
    { text: '聚焦', colors: ['#3179e2'] },
    { text: '创新推动', colors: ['#ccaa44', '#3388dd'] },
  ],
  务实浪漫系列: [
    { text: '做了≠做好了', colors: ['#42e34d'], icon: 'mdi:check-bold' },
    { text: '不断创新', colors: ['#02b0f1', '#02d294'], icon: 'mdi:head-lightbulb' },
    { text: '敢想敢干', colors: ['#0fbfe3'], icon: 'mdi:hand-back-right' },
    { text: '务实浪漫', colors: ['#7e40e3', '#2f62f1'], icon: 'mdi:star-shooting' },
    { text: '梦想实现中', colors: ['#3a85f0'], icon: 'mdi:bird' },
    { text: '快速行动', colors: ['#fe2191'] },
    { text: '一起改变', colors: ['#fcaf03', '#f38121', '#f35e3b'], icon: 'mdi:account-multiple' },
    { text: 'We Are ByteDancers', colors: ['#0080f1'], icon: 'mdi:alpha-b-circle', iconTilt: false },
  ],
  地震级创意: [
    { text: '快速对对', colors: ['#4d52e9', '#9539f9'] },
    { text: '承受因果', colors: ['#58a703', '#d99005', '#fd5b4a'] },
    { text: '语音对一下', colors: ['#09c962', '#14a2c0'], gradientAngle: 90 },
    { text: '震感强烈', colors: ['#9949c1', '#d89a7e', '#feca49'] },
  ],
}

export type StickerPresetGroup = keyof typeof STICKER_PRESETS

/** 贴纸预设分组级默认参数 */
const PRESET_GROUP_DEFAULTS: Record<string, Partial<PresetDefaults>> = {
  字节范: {
    flavor: 'bs',
    outlineStrokeWidth: STICKER_DEFAULT_OUTLINE_WIDTH.bs,
  },
}

/** 按分组归一化后的贴纸预设表 */
export const STICKER_PRESET_GROUPS = Object.fromEntries(Object.entries(
  STICKER_PRESETS,
).map(([group, presets]) => {
  const groupDefaults = PRESET_GROUP_DEFAULTS[group as StickerPresetGroup]
  const normalizedPresets = presets.map((preset) => {
    const icon = preset.icon ?? groupDefaults?.icon ?? PRESET_DEFAULTS.icon
    return {
      ...PRESET_DEFAULTS,
      gradientAngle: defaultGradientAngle(icon),
      ...groupDefaults,
      ...preset,
      icon,
    }
  })
  return [group, normalizedPresets]
})) as Record<StickerPresetGroup, StickerPreset[]>

/** 扁平化后的贴纸预设列表 */
export const STICKER_PRESET_LIST: StickerPreset[] = Object.values(
  STICKER_PRESET_GROUPS,
).flat()
