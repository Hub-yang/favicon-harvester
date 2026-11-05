import type { DomScanResult } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { runAutoIconScan } from './auto-icon-scanner'

const pageUrl = 'https://one.test/page'

function setupPage(overrides: Partial<Browser.tabs.Tab> = {}, scanOverrides: Partial<DomScanResult> = {}) {
  const tab = { id: 1, windowId: 1, active: true, url: pageUrl, status: 'complete', ...overrides } as Browser.tabs.Tab
  const tabs = vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue(tab)
  vi.spyOn(fakeBrowser.windows, 'get').mockResolvedValue({ id: 1, focused: true, type: 'normal', incognito: false, alwaysOnTop: false })
  const permission = vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(true)
  const scan: DomScanResult = { icons: [], pageUrl, ...scanOverrides }
  const injected = { frameId: 0, documentId: 'document-1', result: scan }
  const inject = vi.spyOn(fakeBrowser.scripting, 'executeScript').mockResolvedValue([injected])
  return { tabs, inject, permission }
}

describe('自动扫描的真实门禁', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    await fakeBrowser.storage.local.set({ autoScanEnabled: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('只有已获站点授权的主文档能开始，读取到 URL 不代表获准', async () => {
    const { inject, permission } = setupPage()
    permission.mockResolvedValue(false)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await runAutoIconScan(1, new AbortController().signal)).toBeUndefined()
    expect(permission).toHaveBeenCalledWith({ origins: ['https://one.test/*'] })
    expect(inject).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('主文档和标签页地址不匹配时不发请求', async () => {
    const { inject } = setupPage({}, { pageUrl: 'https://one.test/another' })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    expect(await runAutoIconScan(1, new AbortController().signal)).toBeUndefined()
    expect(inject).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('同源图标解码后计入，跨域候选和 manifest 不发请求并标为不完整', async () => {
    setupPage({}, {
      icons: [
        { href: 'https://one.test/icon.png', rel: 'icon' },
        { href: 'https://two.test/icon.png', rel: 'icon' },
      ],
      manifestHref: 'https://two.test/manifest.json',
    })
    const fetch = vi.fn(async (url: string) => url === 'https://one.test/icon.png'
      ? new Response('valid bytes', { headers: { 'content-type': 'image/png' } })
      : new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 16, height: 16, close: vi.fn() }))
    expect(await runAutoIconScan(1, new AbortController().signal)).toMatchObject({ count: 1, complete: false })
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain('https://two.test/icon.png')
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain('https://two.test/manifest.json')
  })

  it('响应未完成到达时限后返回已确认的部分数量', async () => {
    setupPage({}, { icons: [{ href: 'https://one.test/fast.png', rel: 'icon' }] })
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 16, height: 16, close: vi.fn() }))
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/fast.png'))
        return Promise.resolve(new Response('valid', { headers: { 'content-type': 'image/png' } }))
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
      })
    }))
    vi.useFakeTimers()
    const request = new AbortController()
    let result: Awaited<ReturnType<typeof runAutoIconScan>>
    try {
      void runAutoIconScan(1, request.signal).then(value => result = value)
      await vi.advanceTimersByTimeAsync(8000)
      expect(result).toMatchObject({ count: 1, complete: false })
    }
    finally {
      request.abort()
    }
  })
})
