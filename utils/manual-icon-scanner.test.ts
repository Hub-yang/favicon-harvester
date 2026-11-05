import type { DomScanResult } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { createManualIconScanner } from './manual-icon-scanner'

const SVG = '<svg width="24" height="24"></svg>'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('手动扫描缓存', () => {
  let tab: Browser.tabs.Tab
  let documentId: string | undefined
  let page: DomScanResult
  let request: ReturnType<typeof vi.fn<typeof fetch>>

  beforeEach(async () => {
    fakeBrowser.reset()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    tab = { id: 1, index: 0, windowId: 1, pinned: false, highlighted: false, active: true, frozen: false, incognito: false, selected: true, discarded: false, autoDiscardable: true, groupId: -1, url: 'https://example.com/page' }
    documentId = 'doc-a'
    page = { icons: [{ href: 'https://example.com/icon.svg', rel: 'icon', sizes: '24x24' }] }
    vi.spyOn(fakeBrowser.tabs, 'get').mockImplementation(async id => ({ ...tab, id }))
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(async () => [
      { frameId: 0, documentId, result: structuredClone(page) },
    ])
    request = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('.webmanifest'))
        return new Response('{"icons":[]}', { headers: { 'content-type': 'application/json' } })
      return new Response((url.endsWith('/icon.svg') || url.endsWith('/new-icon.svg') || url.startsWith('data:')) ? SVG : '', {
        status: (url.endsWith('/icon.svg') || url.endsWith('/new-icon.svg') || url.startsWith('data:')) ? 200 : 404,
        headers: { 'content-type': 'image/svg+xml' },
      })
    })
    vi.stubGlobal('fetch', request)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('同文档复用候选，仍读 DOM，但不重复 manifest/候选探测', async () => {
    page.manifestHref = 'https://example.com/site.webmanifest'
    const scanner = createManualIconScanner()
    const first = await scanner.scan(1)
    expect(first.candidates).toHaveLength(1)
    request.mockClear()
    const reads = vi.mocked(fakeBrowser.scripting.executeScript).mock.calls.length
    expect(await scanner.scan(1)).toEqual(first)
    expect(request).not.toHaveBeenCalled()
    expect(vi.mocked(fakeBrowser.scripting.executeScript).mock.calls.length).toBeGreaterThan(reads)
  })

  it('只复用覆盖完整的同文档自动结果，停用后只清除自动来源', async () => {
    const scanner = createManualIconScanner()
    const result = { restricted: false, candidates: [{ url: page.icons[0]!.href, source: 'link' as const }] }
    const entry = {
      count: 1,
      complete: true,
      documentId: documentId!,
      url: tab.url!,
      signature: JSON.stringify([page, tab.favIconUrl]),
      result,
    }
    scanner.rememberAuto(1, { ...entry, complete: false })
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()

    scanner.invalidate(1)
    scanner.rememberAuto(1, entry)
    await scanner.scan(2)
    request.mockClear()
    expect(await scanner.scan(1)).toEqual(result)
    expect(request).not.toHaveBeenCalled()

    scanner.dropAuto()
    await scanner.scan(2)
    expect(request).not.toHaveBeenCalled()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it('29,999 ms 命中不续期，30,000 ms 重扫，负 age 也失效', async () => {
    const scanner = createManualIconScanner()
    await scanner.scan(1)
    request.mockClear()
    vi.setSystemTime(30_999)
    await scanner.scan(1)
    expect(request).not.toHaveBeenCalled()
    vi.setSystemTime(31_000)
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
    request.mockClear()
    vi.setSystemTime(30_000)
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it('force 重扫且失败不会复活旧候选', async () => {
    const scanner = createManualIconScanner()
    await scanner.scan(1)
    request.mockImplementation(async () => new Response('', { status: 404 }))
    expect((await scanner.scan(1, true)).candidates).toEqual([])
    request.mockClear()
    expect((await scanner.scan(1)).candidates).toEqual([])
    expect(request).toHaveBeenCalled()
  })

  it.each(['tab', 'document', 'url', 'hash', 'href', 'rel', 'sizes', 'manifest', 'favicon'])(
    '%s 变化不能复用旧条目',
    async (change) => {
      const scanner = createManualIconScanner()
      await scanner.scan(1)
      request.mockClear()
      if (change === 'document')
        documentId = 'doc-b'
      if (change === 'url')
        tab.url += '?next=1'
      if (change === 'hash')
        tab.url += '#next'
      if (change === 'href')
        page.icons[0]!.href += '?next=1'
      if (change === 'rel')
        page.icons[0]!.rel = 'alternate icon'
      if (change === 'sizes')
        page.icons[0]!.sizes = '32x32'
      if (change === 'manifest')
        page.manifestHref = 'https://example.com/site.webmanifest'
      if (change === 'favicon')
        tab.favIconUrl = 'https://example.com/new-icon.svg'
      await scanner.scan(change === 'tab' ? 2 : 1)
      expect(request).toHaveBeenCalled()
    },
  )

  it('缺 documentId 时连续两次正常重扫', async () => {
    documentId = undefined
    const scanner = createManualIconScanner()
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    request.mockClear()
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    expect(request).toHaveBeenCalled()
  })

  it('受限/注入失败仍用原 favicon 降级且不缓存', async () => {
    tab.favIconUrl = 'https://example.com/icon.svg'
    vi.mocked(fakeBrowser.scripting.executeScript).mockRejectedValue(new Error('denied'))
    const scanner = createManualIconScanner()
    expect(await scanner.scan(1)).toEqual({ restricted: true, candidates: [{ url: tab.favIconUrl, source: 'tab' }] })
    await scanner.scan(1)
    expect(fakeBrowser.scripting.executeScript).toHaveBeenCalledTimes(2)
  })

  it('按写入顺序淘汰，命中不改变顺序，同 tab 重写不增加条目', async () => {
    const scanner = createManualIconScanner()
    for (let id = 1; id <= 20; id++) await scanner.scan(id)
    await scanner.scan(1)
    await scanner.scan(21)
    request.mockClear()
    await scanner.scan(2)
    expect(request).not.toHaveBeenCalled()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
    await scanner.scan(21, true)
    request.mockClear()
    await scanner.scan(3)
    expect(request).not.toHaveBeenCalled()
  })

  it('巨大声明/非 HTTP URL 只跳过缓存，不裁剪候选', async () => {
    const scanner = createManualIconScanner()
    page.icons[0]!.sizes = '大'.repeat(100_000)
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    request.mockClear()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
    page.icons = [{ href: 'data:image/svg+xml,icon.svg', rel: 'icon' }]
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    request.mockClear()
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    expect(request).toHaveBeenCalled()
  })

  it('最新请求胜出，旧操作取消且不能覆写缓存', async () => {
    const scanner = createManualIconScanner()
    const pending = deferred<Response>()
    request.mockImplementationOnce(() => pending.promise)
    const old = scanner.scan(1)
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    page.icons[0]!.href = 'https://example.com/new-icon.svg'
    const fresh = await scanner.scan(1, true)
    pending.resolve(new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } }))
    expect(await old).toEqual({ restricted: false, candidates: [], cancelled: true })
    request.mockClear()
    expect(await scanner.scan(1)).toEqual(fresh)
    expect(request).not.toHaveBeenCalled()
  })

  it('invalidate 取消在途操作并删除结果', async () => {
    const scanner = createManualIconScanner()
    await scanner.scan(1)
    scanner.invalidate(1)
    const pending = deferred<Response>()
    request.mockImplementationOnce(() => pending.promise)
    const old = scanner.scan(1)
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    scanner.invalidate(1)
    pending.resolve(new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } }))
    expect((await old).cancelled).toBe(true)
    request.mockClear()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it.each(['document', 'url', 'declaration', 'unreadable'])(
    '后置校验 %s 变化不会写入缓存',
    async (change) => {
      const scanner = createManualIconScanner()
      const execute = vi.mocked(fakeBrowser.scripting.executeScript)
      execute.mockImplementation(async () => {
        const snapshot = { frameId: 0, documentId, result: structuredClone(page) }
        if (change === 'document')
          documentId = 'doc-b'
        if (change === 'url')
          tab.url += '#next'
        if (change === 'declaration')
          page.icons[0]!.sizes = '48x48'
        if (change === 'unreadable')
          execute.mockRejectedValue(new Error('gone'))
        return [snapshot]
      })
      const result = await scanner.scan(1)
      if (change === 'document' || change === 'url')
        expect(result.cancelled).toBe(true)
      else expect(result.candidates).toHaveLength(1)
      execute.mockImplementation(async () => [{ frameId: 0, documentId, result: structuredClone(page) }])
      request.mockClear()
      await scanner.scan(1)
      expect(request).toHaveBeenCalled()
    },
  )

  it('新实例没有上一个工作线程的缓存', async () => {
    await createManualIconScanner().scan(1)
    request.mockClear()
    await createManualIconScanner().scan(1)
    expect(request).toHaveBeenCalled()
  })

  it('dOM 读取期间过期也不能命中', async () => {
    const scanner = createManualIconScanner()
    await scanner.scan(1)
    vi.setSystemTime(30_999)
    vi.mocked(fakeBrowser.scripting.executeScript).mockImplementation(async () => {
      vi.setSystemTime(31_000)
      return [{ frameId: 0, documentId, result: structuredClone(page) }]
    })
    request.mockClear()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it.each([0, 1])('完整条目 256 KiB 边界 +%i 字节', async (extra) => {
    const scanner = createManualIconScanner()
    // 固定夹具的空 sizes 记录共 383 字节；ASCII padding 同时留在声明签名中。
    page.icons[0]!.sizes = 'x'.repeat(262_144 - 383 + extra)
    expect((await scanner.scan(1)).candidates).toHaveLength(1)
    request.mockClear()
    await scanner.scan(1)
    expect(request.mock.calls.length === 0).toBe(extra === 0)
  })

  it('tTL 从成功完成开始，不从慢请求开始计时', async () => {
    const scanner = createManualIconScanner()
    request.mockImplementationOnce(async () => {
      vi.setSystemTime(50_000)
      return new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } })
    })
    await scanner.scan(1)
    request.mockClear()
    vi.setSystemTime(79_999)
    await scanner.scan(1)
    expect(request).not.toHaveBeenCalled()
    vi.setSystemTime(80_000)
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it('失效标签页读取异常降级，不保留旧候选', async () => {
    const scanner = createManualIconScanner()
    await scanner.scan(1)
    vi.mocked(fakeBrowser.tabs.get).mockRejectedValueOnce(new Error('gone'))
    expect(await scanner.scan(1)).toEqual({ restricted: true, candidates: [] })
    request.mockClear()
    await scanner.scan(1)
    expect(request).toHaveBeenCalled()
  })

  it('旧 tab 查询迟到报错不能删除新操作的缓存', async () => {
    const scanner = createManualIconScanner()
    const pending = deferred<Browser.tabs.Tab>()
    vi.mocked(fakeBrowser.tabs.get).mockImplementationOnce(() => pending.promise)
    const old = scanner.scan(1)
    const fresh = await scanner.scan(1, true)
    pending.reject(new Error('old tab gone'))
    expect((await old).cancelled).toBe(true)
    request.mockClear()
    expect(await scanner.scan(1)).toEqual(fresh)
    expect(request).not.toHaveBeenCalled()
  })
})
