import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import App from '../App'
import { validateStickerSearch } from '../sticker/searchParams'

export const rootRoute = createRootRoute({
  validateSearch: validateStickerSearch,
  component: App,
})

const routeTree = rootRoute

// 本站的 query schema 全是扁平字符串，无需 JSON 序列化。默认的 stringifySearch 会把
// 形如数字的字符串（"90"）再 JSON 包裹成 `"90"`，写进 URL 就成了 ga=%2290%22。
// 这里改用「原样」解析 + 纯字符串化，保证 URL 里是裸值（ga=90）。
const parseSearch = parseSearchWith((value) => value)
const stringifySearch = stringifySearchWith((value) =>
  value == null ? '' : String(value),
)

// 在 iframe 内地址栏由父页控制，因此退回到内存 history，避免与宿主争抢 URL。
const inIframe = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

export const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
  history: inIframe ? createMemoryHistory() : undefined,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
