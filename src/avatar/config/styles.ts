export interface AvatarColorStop {
  srgb: string
}

export interface AvatarStylePreset {
  id: AvatarStyle
  label: string
  stops: [AvatarColorStop, AvatarColorStop]
  solid: string
  gradientAngle?: number
}

export type AvatarStyle =
  | 'aurora'
  | 'deepBlue'
  | 'violet'
  | 'mint'
  | 'gray'
  | 'magenta'
  | 'olive'
  | 'purplePink'
  | 'sunset'
  | 'ocean'
  | 'grape'
  | 'lime'
  | 'orange'
  | 'rose'

export const AVATAR_STYLES: Record<AvatarStyle, AvatarStylePreset> = {
  aurora: {
    id: 'aurora',
    label: '蓝色',
    stops: [
      { srgb: '#4180FF' },
      { srgb: '#6297FC' },
    ],
    solid: '#3174F6',
  },
  deepBlue: {
    id: 'deepBlue',
    label: '深蓝',
    stops: [
      { srgb: '#427CFE' },
      { srgb: '#2865EF' },
    ],
    solid: '#2E6EF3',
  },
  violet: {
    id: 'violet',
    label: '紫色',
    stops: [
      { srgb: '#935AF5' },
      { srgb: '#7C32FF' },
    ],
    solid: '#7C42F2',
    gradientAngle: 180,
  },
  mint: {
    id: 'mint',
    label: '薄荷',
    stops: [
      { srgb: '#0FDBBE' },
      { srgb: '#0BBFA6' },
    ],
    solid: '#149E90',
    gradientAngle: 180,
  },
  gray: {
    id: 'gray',
    label: '灰色',
    stops: [
      { srgb: '#A8AFBA' },
      { srgb: '#6B7280' },
    ],
    solid: '#6B7280',
    gradientAngle: 180,
  },
  magenta: {
    id: 'magenta',
    label: '粉紫',
    stops: [
      { srgb: '#BF40C3' },
      { srgb: '#E69DE5' },
    ],
    solid: '#B93DBD',
  },
  olive: {
    id: 'olive',
    label: '绿黄',
    stops: [
      { srgb: '#2A8930' },
      { srgb: '#A2C10C' },
    ],
    solid: '#2F8D35',
  },
  purplePink: {
    id: 'purplePink',
    label: '紫粉',
    stops: [
      { srgb: '#9054F1' },
      { srgb: '#E69CE7' },
    ],
    solid: '#8A4CE8',
  },
  sunset: {
    id: 'sunset',
    label: '红橙',
    stops: [
      { srgb: '#F44F47' },
      { srgb: '#FF9C4D' },
    ],
    solid: '#F2534C',
  },
  ocean: {
    id: 'ocean',
    label: '蓝绿',
    stops: [
      { srgb: '#356FF4' },
      { srgb: '#5FD269' },
    ],
    solid: '#139AC2',
  },
  grape: {
    id: 'grape',
    label: '靛青',
    stops: [
      { srgb: '#5F66F4' },
      { srgb: '#29ABE7' },
    ],
    solid: '#5E63EE',
  },
  lime: {
    id: 'lime',
    label: '绿青',
    stops: [
      { srgb: '#298A35' },
      { srgb: '#2BB0E8' },
    ],
    solid: '#218F35',
  },
  orange: {
    id: 'orange',
    label: '暖橙',
    stops: [
      { srgb: '#FEA033' },
      { srgb: '#EE8109' },
    ],
    solid: '#F57B0C',
  },
  rose: {
    id: 'rose',
    label: '红粉',
    stops: [
      { srgb: '#E43029' },
      { srgb: '#F59ACD' },
    ],
    solid: '#D63898',
  },
}

export const AVATAR_STYLE_LIST = Object.values(AVATAR_STYLES)
