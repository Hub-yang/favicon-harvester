import type { AutoIconScanResult } from './auto-icon-scanner'
import { i18n } from '#i18n'
import { getAuthorizedAutoTab, runAutoIconScan } from './auto-icon-scanner'
import { readIconPage } from './icon-discovery'

interface PopupScan {
  id: string
  identity?: Pick<AutoIconScanResult, 'url' | 'documentId'>
  count?: number
}

export function createAutoScanController(onScan: (tabId: number, result: AutoIconScanResult) => void) {
  const completed = new Set<number>()
  const popupScans = new Map<number, PopupScan>()
  let job: { tabId: number, controller: AbortController, timer?: ReturnType<typeof setTimeout> } | undefined
  let paused = false

  async function setBadge(tabId: number, count: number, complete = true) {
    const text = count > 0 ? `${count}${complete ? '' : '+'}` : ''
    try {
      await Promise.all([
        browser.action.setBadgeText({ tabId, text }),
        browser.action.setTitle({ tabId, title: text && !complete ? i18n.t('autoScan.partialBadge', [String(count)]) : i18n.t('extName') }),
      ])
    }
    catch {
      // 标签页可能在写入徽章前关闭。
    }
  }

  function cancel(tabId?: number) {
    if (!job || (tabId !== undefined && tabId !== job.tabId))
      return
    const current = job
    job = undefined
    clearTimeout(current.timer)
    current.controller.abort()
  }

  function schedule(tabId: number) {
    if (paused || job?.tabId === tabId)
      return
    cancel()
    if (completed.has(tabId) || (popupScans.has(tabId) && !popupScans.get(tabId)?.identity))
      return
    const current: NonNullable<typeof job> = { tabId, controller: new AbortController() }
    job = current
    current.timer = setTimeout(async () => {
      try {
        const result = await runAutoIconScan(tabId, current.controller.signal)
        if (result && job === current && !current.controller.signal.aborted) {
          completed.add(tabId)
          onScan(tabId, result)
          void setBadge(tabId, result.count, result.complete)
        }
      }
      finally {
        if (job === current)
          job = undefined
      }
    }, 200)
  }

  function refresh(tabId: number) {
    cancel(tabId)
    completed.delete(tabId)
  }

  function invalidate(tabId: number, clearBadge = true) {
    refresh(tabId)
    popupScans.delete(tabId)
    if (clearBadge)
      void setBadge(tabId, 0)
  }

  async function reset() {
    cancel()
    completed.clear()
    popupScans.clear()
    try {
      const tabs = await browser.tabs.query({})
      await Promise.all(tabs.map(tab => tab.id === undefined ? undefined : setBadge(tab.id, 0)))
    }
    catch {
      // 关闭浏览器窗口时，标签页列表可能已不可用。
    }
  }

  function pause() {
    paused = true
    return reset()
  }

  function resume() {
    paused = false
  }

  function beginPopupScan(tabId: number) {
    cancel(tabId)
    const scan = { id: crypto.randomUUID() }
    popupScans.set(tabId, scan)
    return scan.id
  }

  function finishPopupScan(tabId: number, id: string, identity: PopupScan['identity'], count: number) {
    const scan = popupScans.get(tabId)
    if (scan?.id !== id)
      return false
    if (paused || !identity) {
      popupScans.delete(tabId)
      return false
    }
    scan.identity = identity
    scan.count = count
    return true
  }

  async function reportBadgeCount(id: string, count: number) {
    if (paused || !Number.isSafeInteger(count) || count < 0)
      return
    const entry = [...popupScans].find(([, scan]) => scan.id === id)
    if (!entry)
      return
    const [tabId, scan] = entry
    if (!scan.identity || scan.count === undefined || count > scan.count)
      return
    scan.count = count
    try {
      // 工具栏面板拿到焦点后，所属网页窗口可被 Chrome 标记为未聚焦。
      const tab = await getAuthorizedAutoTab(tabId)
      if (!tab || tab.url !== scan.identity.url)
        return
      const page = await readIconPage(tab)
      if (paused || popupScans.get(tabId) !== scan || page.restricted || page.documentId !== scan.identity.documentId
        || page.scan.pageUrl !== scan.identity.url) {
        return
      }
      cancel(tabId)
      completed.add(tabId)
      await setBadge(tabId, scan.count)
    }
    catch {
      // 页面或权限可能在面板渲染期间改变。
    }
  }

  return { schedule, refresh, invalidate, cancel, reset, pause, resume, beginPopupScan, finishPopupScan, reportBadgeCount }
}
