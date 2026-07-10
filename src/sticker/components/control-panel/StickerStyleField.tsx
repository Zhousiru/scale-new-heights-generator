import { Button } from '../../../shared/ui/button'
import type { StickerControls, StickerFlavor } from '../../config/defaults'

const STYLE_OPTIONS: {
  id: StickerFlavor
  label: string
  preview: string
}[] = [
  {
    id: 'snh',
    label: '勇攀高峰',
    preview:
      'https://s3-imfile.feishucdn.com/static-resource/v1/v3_00ut_736f2cf7-04c2-4b85-b8f4-fbf1fdd715eg~',
  },
  {
    id: 'bs',
    label: '字节范',
    preview:
      'https://s3-imfile.feishucdn.com/static-resource/v1/v2_5bfebc72-ea33-48e2-8a35-57590447360g~',
  },
]

interface StickerStyleFieldProps {
  flavor: StickerFlavor
  updateControl: <K extends keyof StickerControls>(
    key: K,
    value: StickerControls[K],
  ) => void
}

export function StickerStyleField({
  flavor,
  updateControl,
}: StickerStyleFieldProps) {
  return (
    <div className="field style-field">
      <span className="field-label">样式</span>
      <div className="style-toggle">
        {STYLE_OPTIONS.map((style) => (
          <Button
            key={style.id}
            type="button"
            variant="secondary"
            className="style-option"
            active={flavor === style.id}
            onClick={() => updateControl('flavor', style.id)}
            title={style.label}
          >
            <img
              className="style-preview"
              src={style.preview}
              alt={style.label}
              draggable={false}
            />
            <span className="style-label">{style.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
