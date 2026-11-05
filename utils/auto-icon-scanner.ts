import type { IconCandidate, ScanResult } from './types'
import { createAutoScanResourceReader } from './auto-scan-resource'
import { readAutoScanEnabled } from './auto-scan-settings'
import { bytesToBase64 } from './base64'
import { inspectCandidateBytes } from './candidate-probe'
import { parseManifestCandidates } from './candidate-sources/manifest-candidates'
import { discoverIcons, readIconPage } from './icon-discovery'
import { checkRestrictedUrl } from './restricted-pages'

const MAX_CANDIDATES = 32
const MAX_CONCURRENT = 4

export interface AutoIconScanResult {
  count: number
  complete: boolean
  documentId: string
  url: string
  signature: string
  result: ScanResult
}

async function hasAutoScanSiteAccess(url: string) {
  const { hostname, protocol } = new URL(url)
  return (protocol === 'https:' || protocol === 'http:')
    && browser.permissions.contains({ origins: [`${protocol}//${hostname}/*`] })
}

export async function getAuthorizedAutoTab(tabId: number) {
  if (!await readAutoScanEnabled())
    return undefined
  const tab = await browser.tabs.get(tabId)
  if (!tab.active || tab.incognito || tab.discarded || tab.status !== 'complete' || !tab.url || checkRestrictedUrl(tab.url))
    return undefined
  if (!await hasAutoScanSiteAccess(tab.url))
    return undefined
  return { ...tab, url: tab.url }
}

async function getEligibleAutoTab(tabId: number, signal: AbortSignal) {
  signal.throwIfAborted()
  const tab = await getAuthorizedAutoTab(tabId)
  if (!tab)
    return undefined
  const window = await browser.windows.get(tab.windowId)
  signal.throwIfAborted()
  return window.focused && window.type === 'normal' ? tab : undefined
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted)
      abort()
  })
}

async function verifySvg(tabId: number, documentId: string, bytes: Uint8Array<ArrayBuffer>, signal: AbortSignal) {
  signal.throwIfAborted()
  const [result] = await abortable(browser.scripting.executeScript<[string], Promise<boolean>>({
    target: { tabId, documentIds: [documentId] },
    world: 'ISOLATED',
    args: [bytesToBase64(bytes)],
    func: async (base64) => {
      const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }))
      const image = new Image()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        image.src = url
        return await Promise.race([
          image.decode().then(() => image.naturalWidth > 0 && image.naturalHeight > 0, () => false),
          new Promise<boolean>((resolve) => { timer = setTimeout(resolve, 1000, false) }),
        ])
      }
      finally {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      }
    },
  }), signal)
  return result?.documentId === documentId && result.result === true
}

export async function runAutoIconScan(tabId: number, signal: AbortSignal): Promise<AutoIconScanResult | undefined> {
  try {
    const before = await getEligibleAutoTab(tabId, signal)
    if (!before)
      return undefined
    const page = await abortable(readIconPage(before), signal)
    if (page.restricted || !page.documentId || page.scan.pageUrl !== before.url)
      return undefined
    const documentId = page.documentId
    const tab = await getEligibleAutoTab(tabId, signal)
    if (!tab || tab.url !== before.url)
      return undefined
    const signature = JSON.stringify([page.scan, tab.favIconUrl])
    const network = new AbortController()
    const stopNetwork = () => network.abort()
    signal.addEventListener('abort', stopNetwork, { once: true })
    const deadline = setTimeout(stopNetwork, 8000)
    const read = createAutoScanResourceReader(tab.url, network.signal)
    let complete = true
    let count = 0
    const result = await discoverIcons(tab, page, {
      async manifest(url) {
        try {
          const data = await read(url, 256 * 1024)
          return data ? parseManifestCandidates(JSON.parse(new TextDecoder().decode(data.bytes)), url) : []
        }
        catch {
          complete = false
          return []
        }
      },
      async probe(candidates) {
        const selected = candidates.slice(0, MAX_CANDIDATES)
        const matches: (IconCandidate | undefined)[] = Array.from({ length: selected.length })
        if (selected.length !== candidates.length)
          complete = false
        let next = 0
        async function run() {
          while (next < selected.length && !network.signal.aborted) {
            const index = next++
            const candidate = selected[index]!
            try {
              const data = await read(candidate.url, 1024 * 1024)
              if (!data)
                continue
              const inspected = await abortable(inspectCandidateBytes(candidate, data.bytes, data.type), network.signal)
              matches[index] = inspected?.candidate
              const verified = inspected?.rasterDecoded || (inspected?.candidate.mimeType === 'image/svg+xml'
                && await verifySvg(tabId, documentId, data.bytes, network.signal))
              if (verified)
                count++
              else
                complete = false
            }
            catch {
              complete = false
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, selected.length) }, run))
        return matches
      },
    }).finally(() => {
      clearTimeout(deadline)
      signal.removeEventListener('abort', stopNetwork)
    })
    const after = await getEligibleAutoTab(tabId, signal)
    if (!after || after.url !== tab.url)
      return undefined
    const latest = await abortable(readIconPage(after), signal)
    if (latest.restricted || latest.documentId !== documentId || JSON.stringify([latest.scan, after.favIconUrl]) !== signature)
      return undefined
    const final = await getEligibleAutoTab(tabId, signal)
    if (!final || final.url !== tab.url || final.favIconUrl !== after.favIconUrl)
      return undefined
    return { count, complete: complete && !network.signal.aborted, documentId, url: tab.url, signature, result }
  }
  catch {
    return undefined
  }
}
