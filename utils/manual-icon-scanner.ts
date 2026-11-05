import type { AutoIconScanResult } from './auto-icon-scanner'
import type { IconPageSnapshot } from './icon-discovery'
import type { ScanResult } from './types'
import { discoverIcons, readIconPage } from './icon-discovery'

interface CacheEntry {
  tabId: number
  url: string
  documentId: string
  signature: string
  completedAt: number
  result: ScanResult
  automatic?: true
}

function signature(tab: Browser.tabs.Tab, page: IconPageSnapshot): string {
  return JSON.stringify([page.restricted ? null : page.scan, tab.favIconUrl])
}

function hasNetworkUrls(tab: Browser.tabs.Tab, page: IconPageSnapshot, result: ScanResult): boolean {
  if (page.restricted)
    return false
  const urls = [tab.url, tab.favIconUrl, page.scan.manifestHref, ...page.scan.icons.map(icon => icon.href), ...result.candidates.map(icon => icon.url)]
  return urls.every(url => !url || /^https?:\/\//i.test(url))
}

function cancelled(): ScanResult {
  return { restricted: false, candidates: [], cancelled: true }
}

export function createManualIconScanner() {
  const cache = new Map<number, CacheEntry>()
  const owners = new Map<number, symbol>()

  function sweep() {
    const now = Date.now()
    for (const [id, entry] of cache) {
      const age = now - entry.completedAt
      if (age < 0 || age >= 30_000)
        cache.delete(id)
    }
  }

  function invalidate(tabId: number) {
    cache.delete(tabId)
    owners.delete(tabId)
  }

  function remember(entry: CacheEntry) {
    if (new TextEncoder().encode(JSON.stringify(entry)).byteLength > 262_144)
      return
    sweep()
    cache.set(entry.tabId, entry)
    if (cache.size > 20)
      cache.delete(cache.keys().next().value!)
  }

  function rememberAuto(tabId: number, data: AutoIconScanResult) {
    sweep()
    const prior = cache.get(tabId)
    if (!data.complete || data.result.restricted || !data.result.candidates.length || owners.has(tabId) || (prior && !prior.automatic))
      return
    remember({
      tabId,
      url: data.url,
      documentId: data.documentId,
      signature: data.signature,
      completedAt: Date.now(),
      result: data.result,
      automatic: true,
    })
  }

  function dropAuto() {
    for (const [tabId, entry] of cache) {
      if (entry.automatic)
        cache.delete(tabId)
    }
  }

  async function scan(tabId: number, force = false, onIdentity?: (identity: { url: string, documentId: string }) => void): Promise<ScanResult> {
    sweep()
    if (force)
      cache.delete(tabId)
    const owner = Symbol('scan')
    owners.set(tabId, owner)
    const current = () => owners.get(tabId) === owner

    try {
      const before = await browser.tabs.get(tabId)
      const page = await readIconPage(before)
      const tab = await browser.tabs.get(tabId)
      if (!current() || before.url !== tab.url)
        return cancelled()

      const key = signature(tab, page)
      sweep()
      const entry = cache.get(tabId)
      if (!force && !page.restricted && page.documentId && entry
        && entry.documentId === page.documentId && entry.url === tab.url && entry.signature === key) {
        onIdentity?.({ url: entry.url, documentId: entry.documentId })
        return entry.result
      }
      cache.delete(tabId)
      const result = await discoverIcons(tab, page)
      if (!current())
        return cancelled()
      if (page.restricted)
        return result

      // 扫描期间页面可能导航；只校验，不因动态图标声明而循环重扫。
      let after: Browser.tabs.Tab
      let latest: IconPageSnapshot
      let finalTab: Browser.tabs.Tab
      try {
        after = await browser.tabs.get(tabId)
        latest = await readIconPage(after)
        finalTab = await browser.tabs.get(tabId)
      }
      catch {
        return current() ? result : cancelled()
      }
      if (!current() || tab.url !== after.url || tab.url !== finalTab.url
        || (!latest.restricted && page.documentId && latest.documentId && page.documentId !== latest.documentId)) {
        return cancelled()
      }
      if (tab.url && page.documentId && !latest.restricted && latest.documentId === page.documentId)
        onIdentity?.({ url: tab.url, documentId: page.documentId })

      if (!result.restricted && result.candidates.length && page.documentId
        && !latest.restricted && latest.documentId === page.documentId
        && signature(finalTab, latest) === key && hasNetworkUrls(tab, page, result)) {
        remember({
          tabId,
          url: tab.url!,
          documentId: page.documentId,
          signature: key,
          completedAt: Date.now(),
          result,
        })
      }
      return result
    }
    catch {
      if (current())
        cache.delete(tabId)
      return current() ? { restricted: true, candidates: [] } : cancelled()
    }
    finally {
      if (current())
        owners.delete(tabId)
    }
  }

  return { scan, invalidate, rememberAuto, dropAuto }
}
