/**
 * 在 popup 自身的渲染上下文里验证一个候选 URL 是否真的能以 <img> 加载出来。
 * 后台 probeCandidate 的 fetch 探测通过 ≠ popup 里能渲染（上下文不同，例如 <img>
 * 会带 Referer，可能被目标站点的防盗链规则拦住），所以需要这层独立校验。
 */
export function verifyImageLoadable(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const finish = (result: boolean) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(result)
    }

    timer = setTimeout(finish, timeoutMs, false)
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = url
  })
}
