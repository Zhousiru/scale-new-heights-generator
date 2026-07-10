import {
  Outlet,
  createRoute,
  createRootRoute,
  createRouter,
  lazyRouteComponent,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'

export const rootRoute = createRootRoute({
  validateSearch: validateStringSearch,
  component: Outlet,
})

const stickerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../App')),
})

const avatarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/avatar',
  component: lazyRouteComponent(() => import('../avatar/AvatarApp'), 'AvatarApp'),
})

const routeTree = rootRoute.addChildren([stickerRoute, avatarRoute])

// 本站的 query schema 全是扁平字符串，无需 JSON 序列化。默认的 stringifySearch 会把
// 形如数字的字符串（"90"）再 JSON 包裹成 `"90"`，写进 URL 就成了 ga=%2290%22。
// 这里改用「原样」解析 + 纯字符串化，保证 URL 里是裸值（ga=90）。
const parseSearch = parseSearchWith((value) => value)
const stringifySearch = stringifySearchWith((value) =>
  value == null ? '' : String(value),
)

export const router = createRouter({
  routeTree,
  // GitHub Pages 部署在 /<仓库名>/ 子路径下，Vite 会把该前缀注入 BASE_URL。
  // 不带这个 basepath，router 会把仓库名前缀当作路由清掉。
  basepath: import.meta.env.BASE_URL,
  parseSearch,
  stringifySearch,
})

function validateStringSearch(search: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') result[key] = value
    else if (typeof value === 'number') result[key] = String(value)
  }
  return result
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
