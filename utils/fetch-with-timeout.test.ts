import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from './fetch-with-timeout'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('正常响应时透传 fetch 结果', async () => {
    const response = new Response('ok')
    const fetchSpy = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchSpy)

    await expect(fetchWithTimeout('https://example.com/icon.png', 5000)).resolves.toBe(response)
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/icon.png', { signal: expect.any(AbortSignal) })
  })

  it('超过 timeoutMs 未响应时 abort，fetch 的 reject 透传给调用方', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))

    const promise = fetchWithTimeout('https://example.com/icon.png', 1000)
    const assertion = expect(promise).rejects.toThrow('aborted')
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })
})
