import {
  Outlet,
  createHashHistory,
  createRoute,
  createRootRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

/** 应用根路由 */
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

function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value == null) continue
    params.set(key, String(value))
  }

  const query = params.toString()
  return query ? `?${query}` : ''
}

/** 应用路由实例 */
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
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
