import type { IconCandidate, ScanResult } from '@/utils/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { buildIconZipDataUrl } from '@/utils/icon-zip'
import { sendMessage } from '@/utils/messaging'
import background from './index'

const scanner = vi.hoisted(() => ({ scan: vi.fn(), invalidate: vi.fn(), rememberAuto: vi.fn(), dropAuto: vi.fn() }))
vi.mock('@/utils/manual-icon-scanner', () => ({ createManualIconScanner: () => scanner }))
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
let onUpdated: Parameters<typeof fakeBrowser.tabs.onUpdated.addListener>[0]
let onRemoved: Parameters<typeof fakeBrowser.tabs.onRemoved.addListener>[0]
let onReplaced: Parameters<typeof fakeBrowser.tabs.onReplaced.addListener>[0]
let onMenuClicked: MenuClickListener | undefined
// main() 返回那一刻监听是否已挂上：service worker 被菜单点击唤醒时，晚一拍注册就会丢掉这次点击
let menuListenerRegisteredOnMain = false

function menuClick(menuItemId: string): Parameters<MenuClickListener>[0] {
  return { menuItemId, editable: false, modifiers: [] }
}

describe('background message handlers', () => {
  // main() 只注册一次消息监听；fakeBrowser 不 reset，避免清掉 messaging 的根监听导致往返失效
  beforeAll(() => {
    vi.spyOn(fakeBrowser.permissions.onRemoved, 'addListener').mockImplementation(() => {})
    vi.spyOn(fakeBrowser.contextMenus.onClicked, 'addListener').mockImplementation((listener) => {
      onMenuClicked = listener
    })
    vi.spyOn(fakeBrowser.tabs.onUpdated, 'addListener').mockImplementation((fn) => {
      onUpdated = fn
    })
    vi.spyOn(fakeBrowser.tabs.onRemoved, 'addListener').mockImplementation((fn) => {
      onRemoved = fn
    })
    vi.spyOn(fakeBrowser.tabs.onReplaced, 'addListener').mockImplementation((fn) => {
      onReplaced = fn
    })
    background.main()
    menuListenerRegisteredOnMain = onMenuClicked !== undefined
  })

  beforeEach(() => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(async message =>
      (await fakeBrowser.runtime.onMessage.trigger(message, { url: fakeBrowser.runtime.getURL('/popup.html') })).find(Boolean))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('只在首次安装打开自动扫描引导，更新时不打断手动使用', async () => {
    vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue('scan-page')
    const openOptions = vi.spyOn(fakeBrowser.runtime, 'openOptionsPage').mockResolvedValue()

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'update', previousVersion: '0.4.0', temporary: false })
    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'browser_update', temporary: false })
    expect(openOptions).not.toHaveBeenCalled()

    await fakeBrowser.runtime.onInstalled.trigger({ reason: 'install', temporary: false })
    expect(openOptions).toHaveBeenCalledTimes(1)
  })

  it('scanIcons：普通请求可复用，force 显式传给扫描器并保留取消语义', async () => {
    const scanResult: ScanResult = { restricted: false, candidates: [], cancelled: true }
    scanner.scan.mockResolvedValue(scanResult)
    expect(await sendMessage('scanIcons', { tabId: 1 })).toEqual(scanResult)
    expect(scanner.scan).toHaveBeenLastCalledWith(1, undefined, expect.any(Function))
    expect(await sendMessage('scanIcons', { tabId: 1, force: true })).toEqual(scanResult)
    expect(scanner.scan).toHaveBeenLastCalledWith(1, true, expect.any(Function))
  })

  it('loading、URL、关闭和替换使缓存失效，favicon 更新不取消扫描', () => {
    const tab = makeTab()
    onUpdated(1, { favIconUrl: 'https://example.com/new.png' }, tab)
    expect(scanner.invalidate).not.toHaveBeenCalled()
    onUpdated(1, { status: 'loading' }, tab)
    onUpdated(2, { url: 'https://example.com/next' }, tab)
    onRemoved(3, { windowId: 1, isWindowClosing: false })
    onReplaced(5, 4)
    expect(scanner.invalidate.mock.calls).toEqual([[1], [2], [3], [4], [5]])
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

  it('拒绝网页上下文利用已授权的后台抓取图标字节', async () => {
    await fakeBrowser.runtime.onMessage.trigger({
      id: 123,
      type: 'fetchIconBytes',
      data: { url: 'https://example.com/private' },
      timestamp: 1,
    }, { url: 'https://untrusted.test/' })
    expect(fetchIconBytes).not.toHaveBeenCalled()
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
