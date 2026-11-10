import { i18n } from '#i18n'
import { createAutoScanController } from '@/utils/auto-scan-controller'
import { AUTO_SCAN_ENABLED_KEY, readAutoScanEnabled } from '@/utils/auto-scan-settings'
import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { buildZipFilename } from '@/utils/icon-naming'
import { buildIconZipDataUrl } from '@/utils/icon-zip'
import { createManualIconScanner } from '@/utils/manual-icon-scanner'
import { onMessage } from '@/utils/messaging'

const SCAN_PAGE_MENU_ID = 'scan-page'

export default defineBackground(() => {
  // 菜单项由 Chrome 持久保存，只需在安装/更新时建一次；每次 service worker 启动都建会报重复 id
  browser.runtime.onInstalled.addListener(async ({ reason }) => {
    browser.contextMenus.create({
      id: SCAN_PAGE_MENU_ID,
      title: i18n.t('contextMenu.scanPage'),
      contexts: ['page'],
    })
    if (reason === 'install') {
      try {
        await browser.runtime.openOptionsPage()
      }
      catch {
        // 用户也可从面板进入设置，不让引导失败影响安装。
      }
    }
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== SCAN_PAGE_MENU_ID)
      return
    try {
      await browser.action.openPopup(tab ? { windowId: tab.windowId } : undefined)
    }
    catch {
      // Chrome < 127 没有 openPopup（同步抛 TypeError），窗口不在前台时会 reject；没有别的退路，静默即可
    }
  })

  const scanner = createManualIconScanner()
  const auto = createAutoScanController(scanner.rememberAuto)
  void browser.action.setBadgeBackgroundColor({ color: '#C62828' }).catch(() => {})

  async function scheduleFocused(expectedTabId?: number) {
    try {
      const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true, windowType: 'normal' })
      if (tab?.id !== undefined && (expectedTabId === undefined || tab.id === expectedTabId))
        auto.schedule(tab.id)
    }
    catch {
      // 焦点窗口可能已经关闭，等下次事件再调度。
    }
  }

  browser.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.status === 'loading' || change.url !== undefined) {
      scanner.invalidate(tabId)
      auto.invalidate(tabId)
    }
    if (change.favIconUrl !== undefined)
      auto.refresh(tabId)
    if (tab.active && (change.status === 'complete'
      || ((change.url !== undefined || change.favIconUrl !== undefined) && tab.status === 'complete'))) {
      void scheduleFocused(tabId)
    }
  })
  browser.tabs.onRemoved.addListener((tabId) => {
    scanner.invalidate(tabId)
    auto.invalidate(tabId, false)
  })
  browser.tabs.onReplaced.addListener((addedId, removedId) => {
    scanner.invalidate(removedId)
    scanner.invalidate(addedId)
    auto.invalidate(removedId, false)
    auto.invalidate(addedId)
    void scheduleFocused(addedId)
  })
  browser.tabs.onActivated.addListener(({ tabId }) => void scheduleFocused(tabId))
  browser.windows.onFocusChanged.addListener((windowId) => {
    auto.cancel()
    if (windowId !== browser.windows.WINDOW_ID_NONE)
      void scheduleFocused()
  })
  browser.permissions.onRemoved.addListener(async () => {
    scanner.dropAuto()
    await auto.reset()
    await scheduleFocused()
  })
  browser.storage.onChanged.addListener((changes, area) => {
    const setting = changes[AUTO_SCAN_ENABLED_KEY]
    if (area !== 'local' || !setting)
      return
    if (setting.newValue === true) {
      auto.resume()
      void scheduleFocused()
    }
    else {
      scanner.dropAuto()
      void auto.pause()
    }
  })

  onMessage('pauseAutoScan', async ({ sender }) => {
    if (sender.url === browser.runtime.getURL('/options.html')) {
      scanner.dropAuto()
      await auto.pause()
    }
  })
  const isPopup = (sender: { url?: string }) => sender.url === browser.runtime.getURL('/popup.html')
  onMessage('scanIcons', async ({ data, sender }) => {
    if (!isPopup(sender))
      return { restricted: true, candidates: [] }
    const id = auto.beginPopupScan(data.tabId)
    let identity: { url: string, documentId: string } | undefined
    const result = await scanner.scan(data.tabId, data.force, (page) => {
      identity = page
    })
    const enabled = identity && !result.cancelled && await readAutoScanEnabled().catch(() => false)
    return auto.finishPopupScan(data.tabId, id, enabled ? identity : undefined, result.candidates.length)
      ? { ...result, badgeScanId: id }
      : result
  })
  onMessage('reportBadgeCount', async ({ data, sender }) => {
    if (isPopup(sender))
      await auto.reportBadgeCount(data.scanId, data.count)
  })

  onMessage('downloadIcon', ({ data, sender }) => isPopup(sender) ? downloadIconFile(data.url, data.filename) : { success: false })

  // popup 里 fetch 跨域图标会被 CORS 拦，取字节这一步必须落在 background
  onMessage('fetchIconBytes', ({ data, sender }) => isPopup(sender) ? fetchIconBytes(data.url) : { success: false })

  /*
   * 打包整包也落在 background：一条消息发出去之后 popup 关不关都不影响，
   * 取字节、zipSync、发起下载全在这里跑完。
   */
  onMessage('downloadIconsZip', async ({ data, sender }) => {
    if (!isPopup(sender))
      return { success: false }
    const zip = await buildIconZipDataUrl(data.candidates, data.domain)
    if (!zip.success || !zip.dataUrl)
      return { success: false, error: zip.error }

    const download = await downloadIconFile(zip.dataUrl, buildZipFilename(data.domain))
    return { ...download, packed: zip.packed, skipped: zip.skipped }
  })
})
