import type { ScanResult } from '@/utils/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { downloadIconFile } from '@/utils/downloads'
import { discoverIcons } from '@/utils/icon-discovery'
import { sendMessage } from '@/utils/messaging'
import background from './index'

// 隔离下层：background 只做"取 tab → 调 discoverIcons / 转发 downloadIconFile"的薄编排
vi.mock('@/utils/icon-discovery', () => ({ discoverIcons: vi.fn() }))
vi.mock('@/utils/downloads', () => ({ downloadIconFile: vi.fn() }))

function makeTab(overrides: Partial<Browser.tabs.Tab> = {}): Browser.tabs.Tab {
  return {
    index: 0,
    windowId: 1,
    pinned: false,
    highlighted: false,
    active: true,
    frozen: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    id: 1,
    url: 'https://example.com/',
    ...overrides,
  }
}

describe('background message handlers', () => {
  // main() 只注册一次消息监听；fakeBrowser 不 reset，避免清掉 messaging 的根监听导致往返失效
  beforeAll(() => {
    background.main()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('scanIcons：取到 tab 后调用 discoverIcons 并回传结果', async () => {
    const tab = makeTab()
    const scanResult: ScanResult = {
      restricted: false,
      candidates: [{ url: 'https://example.com/favicon.ico', source: 'well-known', sourceDetail: 'favicon.ico' }],
    }
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue(tab)
    vi.mocked(discoverIcons).mockResolvedValue(scanResult)

    const result = await sendMessage('scanIcons', { tabId: 1 })

    expect(discoverIcons).toHaveBeenCalledWith(tab)
    expect(result).toEqual(scanResult)
  })

  it('scanIcons：tab.get 抛错时降级为受限空结果，不透传异常', async () => {
    vi.spyOn(fakeBrowser.tabs, 'get').mockRejectedValue(new Error('No tab with id'))

    const result = await sendMessage('scanIcons', { tabId: 999 })

    expect(discoverIcons).not.toHaveBeenCalled()
    expect(result).toEqual({ restricted: true, candidates: [] })
  })

  it('downloadIcon：转发 url 与 filename 给 downloadIconFile', async () => {
    vi.mocked(downloadIconFile).mockResolvedValue({ success: true, downloadId: 7 })

    const result = await sendMessage('downloadIcon', {
      url: 'https://example.com/favicon.ico',
      filename: 'example.com-favicon.ico',
    })

    expect(downloadIconFile).toHaveBeenCalledWith('https://example.com/favicon.ico', 'example.com-favicon.ico')
    expect(result).toEqual({ success: true, downloadId: 7 })
  })
})
