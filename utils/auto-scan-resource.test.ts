import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAutoScanResourceReader } from './auto-scan-resource'

describe('自动扫描资源读取', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('跨源、内嵌和带凭据地址在发请求前拒绝', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const read = createAutoScanResourceReader('https://one.test/page', new AbortController().signal)
    for (const url of ['https://two.test/icon.png', 'data:image/png,abc', 'https://user:pass@one.test/icon.png'])
      await expect(read(url, 32)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('请求省略凭据和 Referer，不跟随重定向', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('abc', { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    const read = createAutoScanResourceReader('https://one.test/page', signal)
    const result = await read('https://one.test/icon.png', 32)
    expect(fetch).toHaveBeenCalledWith('https://one.test/icon.png', { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal })
    expect(result?.bytes).toEqual(new Uint8Array([97, 98, 99]))
  })

  it('按实际读取字节拒绝虚报 Content-Length 的响应', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('long', { headers: { 'content-length': '1' } })))
    const read = createAutoScanResourceReader('https://one.test/', new AbortController().signal)
    await expect(read('https://one.test/a.png', 2)).rejects.toThrow()
  })

  it('取消后不发起新的请求，并把取消信号传给在途请求', async () => {
    const fetch = vi.fn((_url, { signal }: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(signal!.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const read = createAutoScanResourceReader('https://one.test/', controller.signal)
    const pending = read('https://one.test/a.png', 8)
    controller.abort()
    await expect(pending).rejects.toThrow()
    await expect(read('https://one.test/b.png', 8)).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
