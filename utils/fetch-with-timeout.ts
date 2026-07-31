/** 带超时的 fetch：超过 timeoutMs 未响应则 abort，异常（含超时）透传给调用方处理 */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  }
  finally {
    clearTimeout(timer)
  }
}
