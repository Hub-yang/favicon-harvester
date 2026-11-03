import { i18n } from '#i18n'
import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { buildZipFilename } from '@/utils/icon-naming'
import { buildIconZipDataUrl } from '@/utils/icon-zip'
import { createManualIconScanner } from '@/utils/manual-icon-scanner'
import { onMessage } from '@/utils/messaging'

const SCAN_PAGE_MENU_ID = 'scan-page'

export default defineBackground(() => {
  // 菜单项由 Chrome 持久保存，只需在安装/更新时建一次；每次 service worker 启动都建会报重复 id
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: SCAN_PAGE_MENU_ID,
      title: i18n.t('contextMenu.scanPage'),
      contexts: ['page'],
    })
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
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading' || change.url !== undefined)
      scanner.invalidate(tabId)
  })
  browser.tabs.onRemoved.addListener(tabId => scanner.invalidate(tabId))
  browser.tabs.onReplaced.addListener((addedId, removedId) => {
    scanner.invalidate(removedId)
    scanner.invalidate(addedId)
  })
  onMessage('scanIcons', ({ data }) => scanner.scan(data.tabId, data.force))

  onMessage('downloadIcon', ({ data }) => downloadIconFile(data.url, data.filename))

  // popup 里 fetch 跨域图标会被 CORS 拦，取字节这一步必须落在 background
  onMessage('fetchIconBytes', ({ data }) => fetchIconBytes(data.url))

  /*
   * 打包整包也落在 background：一条消息发出去之后 popup 关不关都不影响，
   * 取字节、zipSync、发起下载全在这里跑完。
   */
  onMessage('downloadIconsZip', async ({ data }) => {
    const zip = await buildIconZipDataUrl(data.candidates, data.domain)
    if (!zip.success || !zip.dataUrl)
      return { success: false, error: zip.error }

    const download = await downloadIconFile(zip.dataUrl, buildZipFilename(data.domain))
    return { ...download, packed: zip.packed, skipped: zip.skipped }
  })
})
