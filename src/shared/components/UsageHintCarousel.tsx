import { useEffect, useState } from 'react'

/** 公共环境下展示的使用提示 */
const PUBLIC_USAGE_HINTS = [
  'iframe 里复制/下载可能受限；失败时右键复制或新标签页导出。',
  '复制链接会生成 m=simple 简易模式，适合嵌入预览。',
  '开启 HDR 会导出 JPG；需要透明底时保持普通 PNG。',
  '文本微微旋转一下设成群头像，可以让大家难受一下。',
  '新标签页导出会沿用当前参数，不会丢配置。',
]

/** 内网可达后才展示的内部梗提示 */
const INTRANET_USAGE_HINTS = [
  '▒▒没你确实不行',
  '不明白在说啥，整篇文档',
  '不要总发我表情包',
  '还能搞更大么？',
  '很奇怪都是0',
  '换个人负责这些功能',
  '快干活去吧，算我求求你了',
  '那我回家了',
  '亲！你去吃饭了吗',
  '我看变量名既有 驼峰 又有 下划线，是什么逻辑？',
  '我说白了，那我说白了',
  '永远为▒▒卖命！',
  '找我就行',
  '这个群上班时间一直拼命在闪',
  '最近老出这些低水平错误',
  'omg我还点了merge',
]

interface HintState {
  order: number[]
  cursor: number
}

interface UsageHintCarouselProps {
  showIntranetHints?: boolean
}

export function UsageHintCarousel({
  showIntranetHints = false,
}: UsageHintCarouselProps) {
  const hints = showIntranetHints
    ? [...PUBLIC_USAGE_HINTS, ...INTRANET_USAGE_HINTS]
    : PUBLIC_USAGE_HINTS
  const hintsLength = hints.length
  const [state, setState] = useState<HintState>(() => ({
    order: shuffledIndexes(PUBLIC_USAGE_HINTS.length),
    cursor: 0,
  }))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((current) => nextHintState(current, hintsLength))
    }, 20000)
    return () => window.clearInterval(timer)
  }, [hintsLength])

  useEffect(() => {
    setState((current) => {
      if (current.order.length === hintsLength) return current
      return {
        order: shuffledIndexes(hintsLength, current.order[current.cursor]),
        cursor: 0,
      }
    })
  }, [hintsLength])

  const index = state.order[state.cursor] ?? 0

  return (
    <button
      className="usage-hint"
      type="button"
      title="点击切换提示"
      onClick={() => setState((current) => nextHintState(current, hintsLength))}
    >
      {hints[index]}
    </button>
  )
}

function nextHintState(state: HintState, length: number): HintState {
  const nextCursor = state.cursor + 1
  if (nextCursor < state.order.length) return { ...state, cursor: nextCursor }

  return {
    order: shuffledIndexes(length, state.order[state.cursor]),
    cursor: 0,
  }
}

function shuffledIndexes(length: number, previousLast?: number): number[] {
  const order = Array.from({ length }, (_, index) => index)

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[swapIndex]] = [order[swapIndex], order[index]]
  }

  if (order.length > 1 && order[0] === previousLast) {
    ;[order[0], order[1]] = [order[1], order[0]]
  }

  return order
}
