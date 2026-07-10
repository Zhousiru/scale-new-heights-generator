import { useEffect, useState } from 'react'

const USAGE_HINTS = [
  '普通 PNG 适合日常发送；HDR 高亮适合偶尔强调。',
  'HDR 高亮需要支持 HDR 的屏幕和浏览器，别人不一定能看到同样亮度。',
  '开了 HDR 会导出 JPG；需要透明底时用普通 PNG。',
  '别把 HDR 高亮高频发到群里，+1 EV 已经足够醒目。',
  'HDR 高亮的预览和导出都走同一套增益，看到刺眼就该关。',
  '飞书压缩图片后可能改观感；重要图先发自己小窗确认。',
  '头像模式固定正方形输出，适合群头像和应用头像。',
  '彩环模式是白底图，浅色聊天背景里更稳。',
  '彩底白字更醒目，群名很短时更适合。',
  '文字旋转适合微调气质，角度太大会降低识别效率。',
  '多行头像可以手动换行；三字以内不会强行拆字。',
  '导出文件名会带上文本，下载后更容易找。',
  '找我就行',
  '永远为▒▒卖命！',
  'omg我还点了merge',
  '▒▒没你确实不行',
  '还能搞更大么？',
]

interface HintState {
  order: number[]
  cursor: number
}

export function UsageHintCarousel() {
  const [state, setState] = useState<HintState>(() => ({
    order: shuffledIndexes(),
    cursor: 0,
  }))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState(nextHintState)
    }, 20000)
    return () => window.clearInterval(timer)
  }, [])

  const index = state.order[state.cursor] ?? 0

  return (
    <button
      className="usage-hint"
      type="button"
      title="点击切换提示"
      onClick={() => setState(nextHintState)}
    >
      {USAGE_HINTS[index]}
    </button>
  )
}

function nextHintState(state: HintState): HintState {
  const nextCursor = state.cursor + 1
  if (nextCursor < state.order.length) return { ...state, cursor: nextCursor }

  return {
    order: shuffledIndexes(state.order[state.cursor]),
    cursor: 0,
  }
}

function shuffledIndexes(previousLast?: number): number[] {
  const order = USAGE_HINTS.map((_, index) => index)

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[swapIndex]] = [order[swapIndex], order[index]]
  }

  if (order.length > 1 && order[0] === previousLast) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }

  return order
}
