import { useEffect, useState } from 'react'

/** 内网探测超时时间；只用于避免外网环境长时间挂起 */
const INTRANET_PROBE_TIMEOUT_MS = 1500

export function useIntranetAvailable(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    void probeIntranet()
      .then((reachable) => {
        if (!cancelled) setAvailable(reachable)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return available
}

async function probeIntranet(): Promise<boolean> {
  try {
    await fetch('http://go/', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(INTRANET_PROBE_TIMEOUT_MS),
    })
    // no-cors 响应是 opaque；fulfilled 说明域名已解析并连到 HTTP 端点。
    // 这里故意不判断 status，404 也代表内网可联通。
    return true
  } catch {
    return false
  }
}
