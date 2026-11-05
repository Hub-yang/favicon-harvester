import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { runAutoIconScan } from './auto-icon-scanner'
import { createAutoScanController } from './auto-scan-controller'

vi.mock('./auto-icon-scanner', async importOriginal => ({
  ...await importOriginal<typeof import('./auto-icon-scanner')>(),
  runAutoIconScan: vi.fn(),
}))

const result = {
  count: 2,
  complete: false,
  documentId: 'one',
  url: 'https://one.test/',
  signature: 'same',
  result: { restricted: false, candidates: [] },
}

describe('自动扫描调度与徽章', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue()
    vi.spyOn(fakeBrowser.action, 'setTitle').mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('连续切换只运行最后一个标签页，未扫全显示 N+', async () => {
    vi.mocked(runAutoIconScan).mockResolvedValue(result)
    const controller = createAutoScanController(vi.fn())
    controller.schedule(1)
    controller.schedule(2)
    await vi.advanceTimersByTimeAsync(200)
    expect(runAutoIconScan).toHaveBeenCalledTimes(1)
    expect(runAutoIconScan).toHaveBeenCalledWith(2, expect.any(AbortSignal))
    expect(fakeBrowser.action.setBadgeText).toHaveBeenLastCalledWith({ tabId: 2, text: '2+' })

    controller.schedule(2)
    await vi.advanceTimersByTimeAsync(200)
    expect(runAutoIconScan).toHaveBeenCalledTimes(1)
  })

  it('面板拿到焦点后仍可校正当前文档，撤权后不再更新', async () => {
    await fakeBrowser.storage.local.set({ autoScanEnabled: true })
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({
      id: 1,
      active: true,
      url: result.url,
      status: 'complete',
      windowId: 1,
    } as Browser.tabs.Tab)
    vi.spyOn(fakeBrowser.windows, 'get').mockResolvedValue({
      id: 1,
      focused: false,
      type: 'normal',
      incognito: false,
      alwaysOnTop: false,
    })
    const permission = vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(true)
    const injection = { frameId: 0, documentId: result.documentId, result: { pageUrl: result.url, icons: [] } }
    const inject = vi.spyOn(fakeBrowser.scripting, 'executeScript').mockResolvedValue([injection])

    const controller = createAutoScanController(vi.fn())
    const id = controller.beginPopupScan(1)
    controller.finishPopupScan(1, id, result, 3)
    await controller.reportBadgeCount(id, 2)
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledExactlyOnceWith({ tabId: 1, text: '2' })

    permission.mockResolvedValue(false)
    await controller.reportBadgeCount(id, 1)
    expect(inject).toHaveBeenCalledTimes(1)
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledTimes(1)
  })

  it('导航使旧任务失效并清除徽章，即使请求晚返回也不写回', async () => {
    let finish!: (value: typeof result) => void
    vi.mocked(runAutoIconScan).mockImplementation(() => new Promise(resolve => finish = resolve))
    const controller = createAutoScanController(vi.fn())
    controller.schedule(1)
    await vi.advanceTimersByTimeAsync(200)
    const signal = vi.mocked(runAutoIconScan).mock.calls[0]![1]
    controller.invalidate(1)
    expect(signal.aborted).toBe(true)
    finish(result)
    await vi.advanceTimersByTimeAsync(1)
    expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledExactlyOnceWith({ tabId: 1, text: '' })
  })
})
