import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface AngleKnobProps {
  value: number
  onChange: (angle: number) => void
}

const SIZE = 36
const CENTER = SIZE / 2
const TRACK_R = CENTER - 2
const DOT_R = 4

function angleFromPointer(cx: number, cy: number, clientX: number, clientY: number): number {
  const dx = clientX - cx
  const dy = clientY - cy
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
}

export function AngleKnob({ value, onChange }: AngleKnobProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const startDrag = (e: ReactPointerEvent) => {
    e.preventDefault()
    const el = wrapRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    onChange(Math.round(angleFromPointer(cx, cy, e.clientX, e.clientY)))

    const onMove = (ev: globalThis.PointerEvent) => {
      ev.preventDefault()
      onChange(Math.round(angleFromPointer(cx, cy, ev.clientX, ev.clientY)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const rad = ((value - 90) * Math.PI) / 180
  const dotX = CENTER + (TRACK_R - DOT_R) * Math.cos(rad)
  const dotY = CENTER + (TRACK_R - DOT_R) * Math.sin(rad)

  return (
    <div
      ref={wrapRef}
      className="knob-wrap"
      title={`${value}°`}
      onPointerDown={startDrag}
    >
      <svg
        className="knob"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={TRACK_R}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={1.5}
        />
        <circle cx={dotX} cy={dotY} r={DOT_R} fill="#555" />
      </svg>
    </div>
  )
}
