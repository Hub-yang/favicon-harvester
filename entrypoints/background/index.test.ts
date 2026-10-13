import type { IconCandidate, ScanResult } from '@/utils/types'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { discoverIcons } from '@/utils/icon-discovery'
import { buildIconZipDataUrl } from '@/utils/icon-zip'
import { sendMessage } from '@/utils/messaging'
import background from './index'

// 隔离下层：background 只做"取 tab → 调 discoverIcons / 转发 downloadIconFile"的薄编排
vi.mock('@/utils/icon-discovery', () => ({ discoverIcons: vi.fn() }))
vi.mock('@/utils/downloads', () => ({ downloadIconFile: vi.fn() }))
vi.mock('@/utils/icon-bytes', () => ({ fetchIconBytes: vi.fn() }))
vi.mock('@/utils/icon-zip', () => ({ buildIconZipDataUrl: vi.fn() }))

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

type MenuClickListener = Parameters<typeof fakeBrowser.contextMenus.onClicked.addListener>[0]
let onMenuClicked: MenuClickListener | undefined
// main() 返回那一刻监听是否已挂上：service worker 被菜单点击唤醒时，晚一拍注册就会丢掉这次点击
let menuListenerRegisteredOnMain = false

function menuClick(menuItemId: string): Parameters<MenuClickListener>[0] {
  return { menuItemId, editable: false, modifiers: [] }
}

describe('background message handlers', () => {
  // main() 只注册一次消息监听；fakeBrowser 不 reset，避免清掉 messaging 的根监听导致往返失效
  beforeAll(() => {
    vi.spyOn(fakeBrowser.contextMenus.onClicked, 'addListener').mockImplementation((listener) => {
      onMenuClicked = listener
    })
    background.main()
    menuListenerRegisteredOnMain = onMenuClicked !== undefined
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

  it('fetchIconBytes：转发 url 给 fetchIconBytes', async () => {
    vi.mocked(fetchIconBytes).mockResolvedValue({ success: true, base64: 'AAEC', mimeType: 'image/png' })

    const result = await sendMessage('fetchIconBytes', { url: 'https://example.com/a.png' })

    expect(fetchIconBytes).toHaveBeenCalledWith('https://example.com/a.png')
    expect(result).toEqual({ success: true, base64: 'AAEC', mimeType: 'image/png' })
  })

  it('downloadIconsZip：打包成功后按 buildZipFilename 的路径下载 data URL', async () => {
    const candidates: IconCandidate[] = [{ url: 'https://example.com/a.png', source: 'link' }]
    vi.mocked(buildIconZipDataUrl).mockResolvedValue({
      success: true,
      dataUrl: 'data:application/zip;base64,UEsD',
      packed: 1,
      skipped: 0,
    })
    vi.mocked(downloadIconFile).mockResolvedValue({ success: true, downloadId: 9 })

    const result = await sendMessage('downloadIconsZip', { candidates, domain: 'example.com' })

    expect(buildIconZipDataUrl).toHaveBeenCalledWith(candidates, 'example.com')
    expect(downloadIconFile).toHaveBeenCalledWith(
      'data:application/zip;base64,UEsD',
      'favicon-harvester/example.com-icons.zip',
    )
    expect(result).toEqual({ success: true, downloadId: 9, packed: 1, skipped: 0 })
  })

  it('downloadIconsZip：部分图标取不到时把 skipped 一并回传给面板', async () => {
    vi.mocked(buildIconZipDataUrl).mockResolvedValue({
      success: true,
      dataUrl: 'data:application/zip;base64,UEsD',
      packed: 2,
      skipped: 1,
    })
    vi.mocked(downloadIconFile).mockResolvedValue({ success: true, downloadId: 9 })

    const result = await sendMessage('downloadIconsZip', {
      candidates: [{ url: 'https://example.com/a.png', source: 'link' }],
      domain: 'example.com',
    })

    expect(result).toMatchObject({ success: true, packed: 2, skipped: 1 })
  })

  it('downloadIconsZip：打包失败时不触发下载，透传错误', async () => {
    vi.mocked(buildIconZipDataUrl).mockResolvedValue({ success: false, error: 'all icons failed to fetch' })

    const result = await sendMessage('downloadIconsZip', {
      candidates: [{ url: 'https://example.com/a.png', source: 'link' }],
      domain: 'example.com',
    })

    expect(downloadIconFile).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'all icons failed to fetch' })
  })

  it('downloadIconsZip：下载环节失败时返回失败结果', async () => {
    vi.mocked(buildIconZipDataUrl).mockResolvedValue({
      success: true,
      dataUrl: 'data:application/zip;base64,UEsD',
      packed: 1,
      skipped: 0,
    })
    vi.mocked(downloadIconFile).mockResolvedValue({ success: false, error: 'Download interrupted' })

    const result = await sendMessage('downloadIconsZip', {
      candidates: [{ url: 'https://example.com/a.png', source: 'link' }],
      domain: 'example.com',
    })

    expect(result).toMatchObject({ success: false, error: 'Download interrupted' })
  })

  describe('右键菜单', () => {
    it('安装时创建「提取此页图标」菜单，只挂在页面空白处', async () => {
      const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue('scan-page')

      await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false })

      expect(create).toHaveBeenCalledWith({ id: 'scan-page', title: '提取此页图标', contexts: ['page'] })
    })

    it('点击监听在 main() 里同步注册', () => {
      expect(menuListenerRegisteredOnMain).toBe(true)
    })

    it('点击菜单后在右键所在的窗口打开面板', async () => {
      const openPopup = vi.spyOn(fakeBrowser.action, 'openPopup').mockResolvedValue()

      await onMenuClicked!(menuClick('scan-page'), makeTab({ windowId: 7 }))

      expect(openPopup).toHaveBeenCalledWith({ windowId: 7 })
    })

    it('拿不到 tab 时不传 windowId，交给 Chrome 用当前活动窗口', async () => {
      const openPopup = vi.spyOn(fakeBrowser.action, 'openPopup').mockResolvedValue()

      await onMenuClicked!(menuClick('scan-page'), undefined)

      expect(openPopup).toHaveBeenCalledWith(undefined)
    })

    it('其他菜单项不打开面板', async () => {
      const openPopup = vi.spyOn(fakeBrowser.action, 'openPopup').mockResolvedValue()

      await onMenuClicked!(menuClick('something-else'), makeTab())

      expect(openPopup).not.toHaveBeenCalled()
    })

    it('openPopup reject（如窗口不在前台）时不抛错', async () => {
      vi.spyOn(fakeBrowser.action, 'openPopup').mockRejectedValue(new Error('Could not find an active browser window.'))

      await expect(Promise.resolve(onMenuClicked!(menuClick('scan-page'), makeTab()))).resolves.toBeUndefined()
    })

    it('openPopup 不存在（Chrome < 127）同步抛 TypeError 时也不抛错', async () => {
      vi.spyOn(fakeBrowser.action, 'openPopup').mockImplementation(() => {
        throw new TypeError('browser.action.openPopup is not a function')
      })

      await expect(Promise.resolve(onMenuClicked!(menuClick('scan-page'), makeTab()))).resolves.toBeUndefined()
    })
  })
})
